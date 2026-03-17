// controllers/reservation.controller.js
const db = require("../models"); // Assuming models are correctly imported via index.js
const Reservation = db.Reservation;
const Table = db.Table;
const sequelize = db.sequelize;
const { Op } = db.Sequelize; // Make sure Op is imported correctly

// Helper function: Get io instance from request or app instance
const getIo = (req) => req.io || req.app.get('io');

/**
 * Helper function to check if a table needs to be set to 'reserved'.
 * @param {number} tableId - The ID of the table to check.
 * @param {Date} reservationTime - The time of the reservation.
 * @param {object} transaction - The Sequelize transaction object.
 * @returns {Promise<boolean>} - Returns true if the table status was successfully updated to reserved.
 */
const checkAndReserveTable = async (tableId, reservationTime, transaction) => {
  // Removed io parameter
  if (!tableId || !(reservationTime instanceof Date)) return false;

  const now = new Date();
  const requiredDifferenceMs = 60 * 60 * 1000; // 60 minutes in milliseconds

  // Calculate remaining time in milliseconds
  const timeRemainingMs = reservationTime.getTime() - now.getTime();

  // Only mark 'reserved' if the remaining time is between 0 and 60 minutes
  if (timeRemainingMs >= 0 && timeRemainingMs <= requiredDifferenceMs) {
    const [affectedRows] = await Table.update(
      { status: 'reserved' },
      { where: { id: tableId, status: 'available' }, transaction } // Only update if currently 'available'
    );
    // Return true if rows were affected (status changed)
    return affectedRows > 0;
  }
  // Return false if time is outside the window or update failed
  return false;
};

/**
 * Helper function to check if a table currently 'reserved' should become 'available'.
 * @param {number} tableId - The ID of the table to check.
 * @param {number} excludedReservationId - ID of the reservation just deleted/cancelled/moved.
 * @param {object} transaction - The Sequelize transaction object.
 * @returns {Promise<boolean>} - Returns true if the table status was successfully updated to available.
 */
const checkAndFreeTable = async (tableId, excludedReservationId, transaction) => {
    // Removed io parameter
    if (!tableId) return false;

    const now = new Date();
    // Use the same 30-minute grace period *after* the reservation time
    const gracePeriodPast = new Date(now.getTime() - 30 * 60000); // 30 minutes ago

    // Find any *other* active reservation within the grace period or in the future
    const otherActiveReservation = await Reservation.findOne({
        where: {
            id: { [Op.ne]: excludedReservationId }, // Exclude the current one
            tableId: tableId,
            status: { [Op.in]: ['confirmed', 'arrived'] }, // Still active statuses
            reservationTime: { [Op.gt]: gracePeriodPast } // Check if reservation time is still relevant (within 30 mins past or future)
        },
        transaction // Use the provided transaction
    });

    // If NO other relevant reservations exist for this table, try set it back to available
    if (!otherActiveReservation) {
        const [affectedRows] = await Table.update(
            { status: 'available' },
            {
              where: {
                id: tableId,
                status: 'reserved' // Only change if it's currently 'reserved'
              },
              transaction // Use the provided transaction
            }
        );
        // Return true if rows were affected (status changed)
        return affectedRows > 0;
    }
    // Return false if there are other reservations keeping it reserved or update failed
    return false;
};


// GET /api/reservations - Get all reservations
exports.getAllReservations = async (req, res) => {
    try {
        console.log("Fetching reservations with Table include..."); // Start log
        const reservations = await Reservation.findAll({
            include: [{
                model: Table, // Keep include
                attributes: ['id', 'number'] // Get ID and number for debugging/use
            }],
            order: [['reservationTime', 'ASC']]
        });

        // Log 1: See raw data returned by Sequelize
        // console.log('Raw data from Reservation.findAll:', JSON.stringify(reservations, null, 2)); // Can be verbose

        const results = reservations.map(reservationInstance => {
            // Log 2: Check association directly BEFORE get plain
            // console.log(`Processing ID ${reservationInstance.id}: Instance.Table =`, reservationInstance.Table);

            const plainReservation = reservationInstance.get({ plain: true });

             // Log 3: Check plain object AFTER get plain
             // console.log(`Processing ID ${plainReservation.id}: Plain.Table =`, plainReservation.Table);


            // Assign tableNumber correctly from the nested Table object
            if (plainReservation.Table && plainReservation.Table.number) {
                plainReservation.tableNumber = plainReservation.Table.number;
            } else {
                plainReservation.tableNumber = null; // Assign null if Table or number is missing
                // console.log(`   INFO: tableNumber is null for ID ${plainReservation.id}. plainReservation.Table was:`, plainReservation.Table);
            }

            // Remove the nested Table object to keep the structure flat
            delete plainReservation.Table;

            return plainReservation;
        });

        // console.log("Sending results:", JSON.stringify(results, null, 2)); // Log final results
        res.status(200).send(results); // Send the processed results

    } catch (error) {
        console.error('Critical error in getAllReservations:', error); // Log error details
        res.status(500).send({ message: error.message });
    }
};

// POST /api/reservations - Create a new reservation
exports.createReservation = async (req, res) => {
    const transaction = await sequelize.transaction(); // Start transaction
    let tableIdToEmit = null; // Store ID of table whose status might change

    try {
        const reservationData = req.body;
        // Ensure status defaults correctly if not provided
        if (!reservationData.status) {
            reservationData.status = 'confirmed'; // Default to confirmed
        }
        const reservation = await Reservation.create(reservationData, { transaction });

        // Check and potentially reserve the table immediately after creation
        if (reservation.tableId) {
            const reserved = await checkAndReserveTable(reservation.tableId, reservation.reservationTime, transaction);
            if (reserved) {
                tableIdToEmit = reservation.tableId; // Mark this table for emission
            }
        }

        await transaction.commit(); // Commit transaction

        // === EMIT AFTER COMMIT ===
        if (tableIdToEmit) {
            const tableToEmit = await Table.findByPk(tableIdToEmit); // Fetch final state
            if (tableToEmit) {
                 console.log(`   Emit table_status_updated (createReservation): Table ${tableToEmit.id} -> ${tableToEmit.status}`);
                 getIo(req).emit('table_status_updated', tableToEmit.toJSON());
            }
        }

        // Fetch again after commit to include table number for response consistency
         const createdReservation = await Reservation.findByPk(reservation.id, {
              include: [{ model: Table, attributes: ['number'] }]
         });
         const result = createdReservation.get({plain: true});
         result.tableNumber = result.Table ? result.Table.number : null;
         delete result.Table;

        res.status(201).send(result); // Send the created reservation back

    } catch (error) {
        if (transaction && !transaction.finished) await transaction.rollback(); // Rollback on error
        console.error("Error creating reservation:", error);
        res.status(500).send({ message: error.message });
    }
};

// PATCH /api/reservations/:id - Update reservation status only
exports.updateReservationStatus = async (req, res) => {
    const transaction = await sequelize.transaction();
    let tableIdToEmit = null; // Store ID of table whose status might change

    try {
        const id = req.params.id;
        const newStatus = req.body.status;
        const reservation = await Reservation.findByPk(id, { transaction });

        if (!reservation) { await transaction.rollback(); return res.status(404).send({ message: "Reservation not found." }); }

        const oldTableId = reservation.tableId;

        // Update reservation status
        await reservation.update({ status: newStatus }, { transaction });

        // If cancelled and had a table, check if the table should become available
        if (newStatus === 'cancelled' && oldTableId) {
            const freed = await checkAndFreeTable(oldTableId, id, transaction); // Use ID to exclude this reservation
            if (freed) {
                tableIdToEmit = oldTableId; // Mark this table for emission
            }
        }
        // Add logic here if changing status TO 'confirmed' should trigger checkAndReserveTable

        await transaction.commit(); // Commit transaction

        // === EMIT AFTER COMMIT ===
        if (tableIdToEmit) {
            const tableToEmit = await Table.findByPk(tableIdToEmit); // Fetch final state
            if (tableToEmit) {
                 console.log(`   Emit table_status_updated (updateStatus): Table ${tableIdToEmit} -> ${tableToEmit.status}`);
                 getIo(req).emit('table_status_updated', tableToEmit.toJSON());
            }
        }

        res.status(200).send({ message: "Reservation status updated successfully." });
    } catch (error) {
        if (transaction && !transaction.finished) await transaction.rollback();
        console.error("Error updating reservation status:", error);
        res.status(500).send({ message: error.message });
    }
};

// POST /api/reservations/:id/seat - Seat the customer
exports.seatCustomer = async (req, res) => {
    const transaction = await sequelize.transaction();
    let tableIdToEmit = null; // Store ID of table whose status changed
    try {
        const reservation = await Reservation.findByPk(req.params.id, { transaction });
        if (!reservation) { await transaction.rollback(); return res.status(404).send({ message: "Reservation not found." }); }
        if (!reservation.tableId) { await transaction.rollback(); return res.status(400).send({ message: "No table assigned to this reservation." }); }

        const tableIdToOccupy = reservation.tableId;

        // Update reservation status to 'seated'
        await reservation.update({ status: 'seated' }, { transaction });

        // Update table status to 'occupied', only if it wasn't already occupied
        const [affectedRows] = await Table.update(
            { status: 'occupied' },
            { where: { id: tableIdToOccupy, status: { [Op.ne]: 'occupied' } }, transaction }
        );

        if (affectedRows > 0) {
            tableIdToEmit = tableIdToOccupy; // Mark this table for emission
        }

        await transaction.commit(); // Commit transaction

        // Emit after commit if table status changed
        if (tableIdToEmit) {
            const tableToEmit = await Table.findByPk(tableIdToEmit); // Fetch final state
            if (tableToEmit) {
                console.log(`   Emit table_status_updated (seatCustomer): Table ${tableToEmit.id} -> occupied`);
                getIo(req).emit('table_status_updated', tableToEmit.toJSON());
            }
        }

        res.status(200).send({ message: 'Customer seated successfully.' });

    } catch (error) {
        if (transaction && !transaction.finished) await transaction.rollback(); // Check transaction before rollback
        console.error("Error seating customer:", error);
        res.status(500).send({ message: error.message });
    }
};

// PUT /api/reservations/:id - Update reservation details (including time/table changes)
exports.updateReservation = async (req, res) => {
    const transaction = await sequelize.transaction();
    let tableIdsToEmit = []; // Store IDs of tables whose status might have changed

    try {
        const id = req.params.id;
        const reservation = await Reservation.findByPk(id, { transaction });
        if (!reservation) { await transaction.rollback(); return res.status(404).send({ message: "Reservation not found." }); }

        const oldTableId = reservation.tableId; // Store original table ID
        // Get potential new table ID from body, ensuring it's an integer or null
        const newTableId = req.body.tableId ? parseInt(req.body.tableId, 10) : null;
        // Get potential new reservation time as a Date object
        const newReservationTime = new Date(req.body.reservationTime);

        // Update reservation details first
        await reservation.update(req.body, { transaction });

        // --- Logic to handle table status changes ---
        let oldTableFreed = false;
        let newTableReserved = false;
        let newTableForcedAvailable = false; // Flag if we revert a reserved table

        // 1. Handle the OLD table IF it changed
        if (oldTableId && oldTableId !== newTableId) {
            oldTableFreed = await checkAndFreeTable(oldTableId, id, transaction);
            if (oldTableFreed) tableIdsToEmit.push(oldTableId);
        }

        // 2. Handle the NEW table (or current table if time changed)
        if (newTableId) {
            // Attempt to reserve the new table based on the new time
            newTableReserved = await checkAndReserveTable(newTableId, newReservationTime, transaction);
            if (newTableReserved) {
                if (tableIdsToEmit.indexOf(newTableId) === -1) tableIdsToEmit.push(newTableId);
            }
            // *** FIX FOR MOVING TIME OUTSIDE 60 MINS ***
            // If it wasn't reserved (time > 60 mins away) AND the table IS currently reserved
            else {
                const currentTableState = await Table.findByPk(newTableId, { attributes: ['status'], transaction });
                if (currentTableState && currentTableState.status === 'reserved') {
                    // Force it back to 'available'
                    const [affectedRows] = await Table.update(
                        { status: 'available' },
                        { where: { id: newTableId, status: 'reserved' }, transaction }
                    );
                    if (affectedRows > 0) {
                        newTableForcedAvailable = true;
                        console.log(`   Force reverted Table ${newTableId} to 'available' because new time is > 60 mins away.`);
                        if (tableIdsToEmit.indexOf(newTableId) === -1) tableIdsToEmit.push(newTableId);
                    }
                }
            }
            // ********************************************
        }
        // Handle case where table assignment is REMOVED (newTableId is null but oldTableId existed)
        else if (oldTableId && !newTableId) {
             oldTableFreed = await checkAndFreeTable(oldTableId, id, transaction);
             if (oldTableFreed) tableIdsToEmit.push(oldTableId);
        }
        // --- End table status logic ---

        await transaction.commit(); // Commit transaction

        // === EMIT SOCKET AFTER COMMIT ===
        if (tableIdsToEmit.length > 0) {
            const uniqueTableIdsToEmit = [...new Set(tableIdsToEmit)]; // Ensure unique IDs
            console.log("   ==> Emitting updates after reservation update for tables:", uniqueTableIdsToEmit);
            const tablesDataToEmit = await Table.findAll({
                 where: { id: { [Op.in]: uniqueTableIdsToEmit } }
                 // Consider including activeOrder if needed by frontend
            });
            tablesDataToEmit.forEach(table => {
                 console.log(`   Emit table_status_updated (updateReservation): Table ${table.id} -> ${table.status}`);
                 getIo(req).emit('table_status_updated', table.toJSON());
            });
        }
        // ============================

        // Fetch again after commit to include table number for the response
         const updatedReservation = await Reservation.findByPk(id, {
             include: [{ model: Table, attributes: ['number'] }]
         });
         const result = updatedReservation.get({plain: true});
         result.tableNumber = result.Table ? result.Table.number : null;
         delete result.Table;

        res.status(200).send(result); // Send updated reservation data back

    } catch (error) {
        if (transaction && !transaction.finished) await transaction.rollback();
        console.error("Error updating reservation:", error);
        res.status(500).send({ message: error.message });
    }
};

// DELETE /api/reservations/:id - Delete a reservation
exports.deleteReservation = async (req, res) => {
    const transaction = await sequelize.transaction();
    let tableIdToEmit = null; // Store ID of table whose status might change
    try {
        const id = req.params.id;
        const reservation = await Reservation.findByPk(id, { transaction });
        if (!reservation) { await transaction.rollback(); return res.status(404).send({ message: "Reservation not found." }); }

        const tableId = reservation.tableId; // Store the associated table ID before deleting

        // Delete the reservation
        await reservation.destroy({ transaction });

        // Check if the associated table needs to be freed
        if (tableId) {
            const freed = await checkAndFreeTable(tableId, id, transaction); // Use ID to exclude the deleted one
            if (freed) {
                tableIdToEmit = tableId; // Mark this table for emission
            }
        }

        await transaction.commit(); // Commit transaction

        // === EMIT SOCKET AFTER COMMIT ===
        if (tableIdToEmit) {
             const tableToEmit = await Table.findByPk(tableIdToEmit); // Fetch final state
             if (tableToEmit) {
                  console.log(`   Emit table_status_updated (deleteReservation): Table ${tableIdToEmit} -> ${tableToEmit.status}`);
                  getIo(req).emit('table_status_updated', tableToEmit.toJSON());
             }
        }

        res.status(200).send({ message: "Reservation deleted successfully." });
    } catch (error) {
        if (transaction && !transaction.finished) await transaction.rollback();
        console.error("Error deleting reservation:", error);
        res.status(500).send({ message: error.message });
    }
};