const db = require("../models");
const User = db.User;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
console.log(bcrypt.hashSync("Aa123", 10)); 

// ----- HÀM SIGNIN ĐÃ CẬP NHẬT -----
exports.signin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
        return res.status(400).send({ message: "Mã PIN là bắt buộc." });
    }
    
    // CẢNH BÁO HIỆU SUẤT: Lệnh này tải TẤT CẢ user đang hoạt động.
    // Với mã PIN đã hash, đây là cách tiếp cận bắt buộc nhưng sẽ chậm lại khi có nhiều user.
    const users = await User.findAll({ where: { isActive: true } });
    if (!users || users.length === 0) {
      return res.status(404).send({ message: "Không tìm thấy tài khoản nào đang hoạt động." });
    }

    let foundUser = null;
    for (const user of users) {
      // So sánh mã PIN đã được hash một cách an toàn
      const pinIsValid = bcrypt.compareSync(String(pin).trim(), user.pin);
      if (pinIsValid) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser) {
      return res.status(401).send({ message: "Mã PIN không đúng hoặc tài khoản đã bị khóa." });
    }

    // --- LOGIC BẢO MẬT ADMIN ---
    if (foundUser.role === 'admin') {
      return res.status(200).send({
        adminChallenge: true,
        // CẢI TIẾN: Dùng 'id' thay vì 'userId' để nhất quán
        id: foundUser.id,
        name: foundUser.name,
        role: foundUser.role,
      });
    }

    // Nếu là nhân viên thường, tạo và trả về token
    const token = jwt.sign(
      { id: foundUser.id, role: foundUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).send({
      id: foundUser.id,
      name: foundUser.name,
      role: foundUser.role,
      accessToken: token,
    });

  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).send({ message: "Đã có lỗi xảy ra trong quá trình đăng nhập." });
  }
};

// ----- HÀM XÁC THỰC MASTER PIN (Giữ nguyên, đã tốt) -----
exports.verifyAdmin = async (req, res) => {
    const { userId, masterPin } = req.body;
    if (!userId || !masterPin) {
        return res.status(400).send({ message: "Yêu cầu thiếu thông tin userId hoặc masterPin." });
    }

    try {
        const adminUser = await User.findByPk(userId);
        if (!adminUser || adminUser.role !== 'admin' || !adminUser.masterPin) {
            return res.status(403).send({ message: "Tài khoản không hợp lệ hoặc không phải admin." });
        }

        const masterPinIsValid = bcrypt.compareSync(String(masterPin).trim(), adminUser.masterPin);

        if (!masterPinIsValid) {
            return res.status(401).send({ message: "Master PIN không chính xác." });
        }

        const token = jwt.sign(
            { id: adminUser.id, role: adminUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).send({
            id: adminUser.id,
            name: adminUser.name,
            role: adminUser.role,
            accessToken: token,
        });

    } catch (error) {
        console.error("Lỗi xác thực admin:", error);
        res.status(500).send({ message: "Đã có lỗi xảy ra." });
    }
};

// ----- CÁC HÀM QUẢN LÝ USER KHÁC (Giữ nguyên, đã tốt) -----

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({ attributes: ['id', 'name', 'role', 'isActive', 'createdAt'] });
        res.status(200).send(users);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, pin, role, masterPin } = req.body;
        if (!name || !pin || !role) {
            return res.status(400).send({ message: "Name, pin, và role là bắt buộc!" });
        }

        const userData = {
            name: name,
            pin: bcrypt.hashSync(String(pin), 8),
            role: role,
            isActive: true
        };

        if (role === 'admin' && masterPin) {
            userData.masterPin = bcrypt.hashSync(String(masterPin), 10);
        }

        const user = await User.create(userData);
        res.status(201).send({ message: "User được tạo thành công!", userId: user.id });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { name, role, isActive } = req.body;
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).send({ message: "User Not found." });
        }
        await user.update({ name, role, isActive });
        res.status(200).send({ message: "User was updated successfully." });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).send({ message: "User Not found." });
        }
        await user.destroy();
        res.status(200).send({ message: "User was deleted successfully." });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};
exports.completeAdminLogin = async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).send({ message: "userId is required." });
    }

    try {
        const adminUser = await User.findByPk(userId);
        // Kiểm tra kỹ lại xem có đúng là admin không
        if (!adminUser || adminUser.role !== 'admin' || !adminUser.isActive) {
            return res.status(403).send({ message: "Invalid admin account." });
        }

        // Tạo token JWT
        const token = jwt.sign(
            { id: adminUser.id, role: adminUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Trả về thông tin user và token mới
        res.status(200).send({
            id: adminUser.id,
            name: adminUser.name,
            role: adminUser.role,
            accessToken: token, 
        });

    } catch (error) {
        console.error("Error completing admin login:", error);
        res.status(500).send({ message: "Error completing admin login." });
    }
};