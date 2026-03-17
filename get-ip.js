const os = require('os');

function getServerIp() {
    const networkInterfaces = os.networkInterfaces();
    // Lặp qua tất cả các giao diện mạng (Wi-Fi, Ethernet, ...)
    for (const interfaceName in networkInterfaces) {
        const interfaceInfo = networkInterfaces[interfaceName];
        for (const info of interfaceInfo) {
            // Chỉ lấy địa chỉ IPv4 và không phải là địa chỉ nội bộ (127.0.0.1)
            if (info.family === 'IPv4' && !info.internal) {
                return info.address; // Trả về địa chỉ IP đầu tiên tìm thấy
            }
        }
    }
    return 'localhost'; // Trả về localhost nếu không tìm thấy IP
}

module.exports = getServerIp;