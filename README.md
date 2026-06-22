# AWING Auto-Login Script

Script tự động vượt qua Captive Portal của mạng WiFi AWING (hệ thống quản lý sử dụng Mikrotik Router). Phù hợp để tự động kết nối mạng WiFi ở Ký túc xá, quán cà phê hoặc trung tâm thương mại mà không cần phải nhấp tay vào màn hình đăng nhập.

## ✨ Tính năng
- Tự động bắt gói tin và lấy `chap_challenge` trực tiếp từ Mikrotik Router.
- Tự động gọi API giả lập quá trình xem quảng cáo (Analytic View/Click) để thoả mãn điều kiện của máy chủ AWING.
- Tự động bóc tách mã hoá CHAP và gửi POST lệnh đăng nhập vào Router để cấp quyền truy cập Internet.
- **Chạy nền (Background Task):** Script tích hợp đồng hồ đếm ngược thời gian động và cơ chế chạy đệ quy tự động kiểm tra, gia hạn kết nối mỗi 30 phút. 
- **Auto-Retry & Force Logout:** Tự động phát hiện phiên làm việc (session) bị kẹt và tự động gửi lệnh force logout để bắt đầu quy trình cấp IP lại từ đầu.

---

## 💻 1. Hướng dẫn chạy trên Máy tính (Windows / macOS / Linux)

**Yêu cầu:** Máy tính đã cài đặt [Node.js](https://nodejs.org/).

1. Kết nối vào mạng WiFi AWING (Lúc này biểu tượng mạng sẽ có dấu chấm than báo chưa có Internet).
2. Tải source code này (`index.js`) về thư mục máy tính.
3. Mở Terminal (Command Prompt / PowerShell / Bash) tại thư mục chứa code.
4. Chạy lệnh:
   ```bash
   node index.js
   ```
5. Treo cửa sổ Terminal đó (hoặc thu nhỏ lại). Script sẽ lấy Internet cho bạn và tiếp tục đếm ngược để tự động gia hạn kết nối.

---

## 📱 2. Hướng dẫn chạy trên Điện thoại Android (Sử dụng Termux)

Bạn hoàn toàn có thể treo script này trên điện thoại Android để điện thoại tự động vượt rào WiFi AWING mọi lúc mà không cần root máy.

### Yêu cầu ban đầu
Cài đặt ứng dụng **Termux** từ [F-Droid](https://f-droid.org/en/packages/com.termux/) (Lưu ý: Không tải từ Google Play vì bản đó không còn được hỗ trợ cập nhật).

### Các bước thiết lập
**Bước 1: Cài đặt Node.js cho Termux**
Mở ứng dụng Termux lên và lần lượt gõ các lệnh sau:
```bash
pkg update && pkg upgrade -y
pkg install nodejs -y
```

**Bước 2: Cấp quyền bộ nhớ cho Termux**
Gõ lệnh sau để Termux có thể tìm và đọc file script từ thư mục điện thoại:
```bash
termux-setup-storage
```
*(Sẽ có bảng thông báo hiện lên yêu cầu cấp quyền, bạn chọn Cho phép / Allow).*

**Bước 3: Đưa script vào Termux**
Tải file `index.js` này về máy điện thoại (mặc định lưu ở thư mục `Download`). Dùng lệnh sau để copy file vào thư mục hoạt động của Termux:
```bash
cp /storage/emulated/0/Download/index.js ~/
```

**Bước 4: Chạy Script**
Gõ lệnh:
```bash
node index.js
```
Script sẽ bắt đầu chạy và đếm ngược trên điện thoại giống hệt như trên máy tính.

### 💡 Mẹo: Treo script chạy ngầm vĩnh viễn trên Android
Để tránh việc hệ điều hành Android tự động tắt Termux khi bạn thoát ứng dụng nhằm tiết kiệm pin:
1. Vào **Cài đặt (Settings)** của điện thoại -> **Ứng dụng (Apps)** -> Tìm ứng dụng **Termux**.
2. Tìm phần quản lý **Pin (Battery)** -> Chọn **Không hạn chế (Unrestricted / No Optimization)**.
3. Để treo tiến trình chuyên nghiệp nhất, bạn có thể cài thêm thư viện quản lý tiến trình `pm2`:
   ```bash
   npm install -g pm2
   pm2 start index.js
   pm2 save
   ```
   Lúc này, kể cả khi bạn vuốt đóng ứng dụng Termux, script vẫn âm thầm chạy ở chế độ nền và tự động cấp WiFi cho bạn mỗi khi cần.

---

## ⚙️ Cấu hình (Configuration)
Bạn có thể mở file `index.js` bằng bất kỳ Text Editor nào để sửa đổi tần suất tự động quét mạng:
```javascript
const INTERVAL_MINUTES = 30; // Chỉnh thành 1 nếu bạn muốn kiểm tra trạng thái mạng mỗi 1 phút
```

## ⚠️ Lưu ý
- Script yêu cầu bạn phải đang bắt sóng trực tiếp WiFi AWING thì mới có thể chạy được (nếu không script sẽ báo `Không tìm thấy wifiInfo`).
- Không đổi tên các header mặc định trong script để tránh bị máy chủ AWING block.
