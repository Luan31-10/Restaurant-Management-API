Hệ thống Backend API - Quản lý Nhà hàng

Đây là hệ thống Backend cung cấp các API RESTful mạnh mẽ để xử lý logic nghiệp vụ, quản lý cơ sở dữ liệu và giao tiếp thời gian thực (Real-time) cho ứng dụng di động Quản lý Nhà hàng.

 Các chức năng cốt lõi (Core Features)

* Xử lý Đơn hàng phức tạp (Order Management): Cung cấp API tạo đơn hàng mới tích hợp Database Transaction, đảm bảo tính toàn vẹn dữ liệu khi tạo hóa đơn và thêm món ăn cùng lúc.
* Giao tiếp Real-time (WebSocket): Tích hợp 'Socket.io' để đẩy (emit) thông báo ngay lập tức cho Bếp (khi có order mới/sửa món) và Nhân viên phục vụ (khi món đã sẵn sàng hoặc bàn thay đổi trạng thái).
* Quản lý Bàn (Table Management): Tự động đồng bộ và cập nhật trạng thái bàn (Trống, Đang phục vụ, Chờ thanh toán) dựa trên tiến trình của đơn hàng.
* Làm sạch dữ liệu (Data Sanitization): Sử dụng các Helper function để chuẩn hóa dữ liệu đầu ra, loại bỏ các trường dư thừa trước khi trả về Frontend, tối ưu hóa băng thông.

 Công nghệ & Kiến trúc (Tech Stack)

* Nền tảng (Runtime): Node.js
* Framework: Express.js
* Cơ sở dữ liệu: MySQL
* ORM (Object-Relational Mapping): Sequelize
* Real-time Engine: Socket.io
* Kiến trúc: MVC (Model - View - Controller) mở rộng với thư mục 'services' và 'middleware'.

Cấu trúc thư mục (Project Structure)

* 'controllers/': Chứa logic xử lý của các API (VD: 'ordercontroller.js').
* 'models/': Định nghĩa các schema cơ sở dữ liệu (Sequelize models).
* 'routes/': Định tuyến các API endpoints.
* 'middleware/': Xử lý xác thực (Authentication), phân quyền hoặc bắt lỗi.
* 'services/': Xử lý các logic nghiệp vụ dùng chung.
* 'server.js': File khởi chạy hệ thống và cấu hình Socket.io.

Hướng dẫn cài đặt (Getting Started)

Để khởi chạy server backend này trên máy cá nhân, vui lòng đảm bảo bạn đã cài đặt **Node.js** và cấu hình sẵn **Cơ sở dữ liệu**.

1. Clone mã nguồn về máy:
   
   git clone [https://github.com/Luan31-10/Restaurant-Management-API.git](https://github.com/Luan31-10/Restaurant-Management-API.git)
2. Cài đặt các thư viện (Dependencies):


cd Restaurant-Management-API
npm install
3. Cấu hình môi trường (Environment Variables):

Tạo một file .env ở thư mục gốc.

4. Khai báo các thông số kết nối Database:

Đoạn mã
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=restaurant_db
5. Khởi chạy Server:

npm start
(Hoặc chạy lệnh node server.js)

 Thông tin tác giả
Võ Thành Luân - Sinh viên chuyên ngành Công nghệ Phần mềm - ĐH HUTECH

Frontend Repository: https://github.com/Luan31-10/Restaurant-Management-App.git

GitHub: https://github.com/Luan31-10
