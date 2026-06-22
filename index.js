const GATEWAY_LOGIN = "http://186.186.0.1/login";
const GATEWAY_LOGOUT = "http://186.186.0.1/logout?";
const GATEWAY_STATUS = "http://186.186.0.1/status";

const AWING_BASE_URL = "http://v1.awingconnect.vn";
const AWING_LOGIN_URL = `${AWING_BASE_URL}/login`;
const AWING_SUCCESS_URL = `${AWING_BASE_URL}/Success`;
const AWING_VERIFY_URL = `${AWING_BASE_URL}/Home/VerifyUrl`;
const AWING_ANALYTIC_URL = `${AWING_BASE_URL}/Analytic/Send`;

const USER_AGENT = "PostmanRuntime/7.54.0";
const INTERVAL_MINUTES = 30;
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;
// Biến toàn cục lưu cookie của Router
let routerCookies = "";

async function loginWifi() {
    // console.log("=== AUTO LOGIN WIFI (API FLOW) ===\n");

    // ==========================================
    // BƯỚC 1: Lấy wifiInfo từ Router Mikrotik
    // ==========================================
    console.log("[*] Bước 1: Lấy thông tin từ Router...");
    let loginHtml;
    try {
        const res = await fetch(GATEWAY_LOGIN);
        
        // Trích xuất cookie từ header
        const setCookieHeader = res.headers.raw && res.headers.raw()['set-cookie'] 
                                ? res.headers.raw()['set-cookie'] 
                                : res.headers.get("set-cookie");
        if (setCookieHeader) {
            if (Array.isArray(setCookieHeader)) {
                routerCookies = setCookieHeader.map(c => c.split(';')[0]).join('; ');
            } else {
                routerCookies = setCookieHeader.split(',').map(c => c.split(';')[0]).join('; ');
            }
        }
        
        loginHtml = await res.text();
    } catch (e) {
        console.error("[-] Lỗi kết nối tới Router:", e.message);
        return;
    }

    const infoMatch = loginHtml.match(/const\s+wifiInfo\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (!infoMatch) {
        console.log("[-] Không tìm thấy wifiInfo. Có thể do kẹt session hoặc đang ở trang status.");
        console.log("    -> Tiến hành Force Logout...");
        try {
            await fetch(GATEWAY_LOGOUT, {
                headers: {
                    "Referer": GATEWAY_STATUS,
                    "Cookie": routerCookies
                }
            });
            console.log("    -> Đã gửi lệnh Logout thành công. Đang thử lại (Retry) sau 3s...");
            await new Promise(r => setTimeout(r, 3000));
            return await loginWifi(); // Gọi lại đệ quy để bắt đầu luồng login mới
        } catch (err) {
            console.error("[-] Lỗi khi logout:", err.message);
            return;
        }
    }
    const wifiInfo = new Function("return " + infoMatch[1])();
    
    if (wifiInfo["logged-in"] === "yes") {
        console.log("[+] Bạn đã đăng nhập Internet rồi!");
        return;
    }

    console.log(`    MAC: ${wifiInfo.mac}`);
    console.log(`    IP : ${wifiInfo.ip}`);

    // Hàm chuyển đổi chuỗi byte sang dạng \octal (ví dụ: \152\376...)
    function toUrlOctal(str) {
        if (!str) return "";
        let res = "";
        for (let i = 0; i < str.length; i++) {
            res += "\\" + str.charCodeAt(i).toString(8).padStart(3, '0');
        }
        return res;
    }

    const chapIdStr = toUrlOctal(wifiInfo.chap_id);
    const chapChallengeStr = toUrlOctal(wifiInfo.chap_challenge);

    // Xây dựng trực tiếp URL AWING mà không cần thông qua ex.login.net.vn
    // URL này chứa MAC, IP và chuỗi challenge chính xác của phiên hiện tại.
    const awingUrl = `${AWING_LOGIN_URL}?serial=CC:2D:E0:1C:00:67&client_mac=${wifiInfo.mac}&client_ip=${wifiInfo.ip}&userurl=&login_url=${GATEWAY_LOGIN}&chap_id=${chapIdStr}&chap_challenge=${chapChallengeStr}`;
    
    console.log(`    Đã khởi tạo URL AWING: ${awingUrl.substring(0, 100)}...`);

    // ==========================================
    // BƯỚC 3: Gọi VerifyUrl của AWING
    // ==========================================
    console.log("\n[*] Bước 3: Gọi API VerifyUrl của AWING để lấy Form...");
    
    // Gắn URL nhận được vào header Referer để AWING biết thông tin thiết bị
    let verifyResponse;
    try {
        const res = await fetch(AWING_VERIFY_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
                "Referer": awingUrl,
                "Origin": AWING_BASE_URL
            }
            // KHÔNG truyền body theo đúng logic của awing-captive.min.js
        });
        verifyResponse = await res.json();
    } catch (e) {
        console.error("[-] Lỗi khi gọi VerifyUrl:", e.message);
        return;
    }

    const contentForm = verifyResponse?.captiveContext?.contentAuthenForm;
    if (!contentForm) {
        console.error("[-] Không tìm thấy contentAuthenForm trong phản hồi VerifyUrl.");
        console.log(verifyResponse);
        return;
    }

    // ==========================================
    // BƯỚC 4: Trích xuất username và password
    // ==========================================
    console.log("\n[*] Bước 4: Trích xuất thông tin CHAP password...");
    
    const userMatch = contentForm.match(/name="username"\s+value="([^"]+)"/i);
    const passMatch = contentForm.match(/name="password"\s+value="([^"]+)"/i);
    
    if (!userMatch || !passMatch) {
        console.error("[-] Không thể parse username/password từ Form HTML.");
        return;
    }

    const username = userMatch[1];
    const password = passMatch[1];

    console.log(`    Username: ${username}`);
    console.log(`    Password: ${password}`);

    // ==========================================
    // BƯỚC 4.5: Gửi Analytic (Giả lập đã xem quảng cáo)
    // ==========================================
    console.log("\n[*] Bước 4.5: Gửi Analytic (Giả lập đã xem và bấm kết nối)...");
    
    // Khởi tạo DTO hiện tại từ kết quả VerifyUrl
    let currentDTO = verifyResponse;
    if (currentDTO.captiveContext) {
        currentDTO.captiveContext.userContext = {};
    }

    try {
        console.log("    -> Gửi Analytic [View]...");
        const resView = await fetch(AWING_ANALYTIC_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
                "Referer": awingUrl,
                "Origin": AWING_BASE_URL
            },
            body: JSON.stringify({
                captiveContextDTO: currentDTO,
                analyticType: "View",
                viewIndex: 1
            })
        });
        
        // MẤU CHỐT TỪ AWING-CAPTIVE: Cập nhật lại DTO từ response (có token mới)
        const viewResponseDTO = await resView.json();
        if (viewResponseDTO && viewResponseDTO.token) {
            currentDTO = viewResponseDTO;
        }
        
        console.log("    -> Gửi Analytic [Click]...");
        await fetch(AWING_ANALYTIC_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
                "Referer": awingUrl,
                "Origin": AWING_BASE_URL
            },
            body: JSON.stringify({
                captiveContextDTO: currentDTO,
                analyticType: "Click",
                viewIndex: 0
            })
        });
    } catch (e) {
        console.error("[-] Lỗi khi gửi Analytic:", e.message);
    }

    // ==========================================
    // BƯỚC 5: Gửi thông tin đăng nhập cho Router
    // ==========================================
    console.log("\n[*] Bước 5: Gửi POST đăng nhập đến Mikrotik Router...");
    
    const loginParams = new URLSearchParams();
    loginParams.append("username", username);
    loginParams.append("password", password);
    loginParams.append("dst", AWING_SUCCESS_URL);
    loginParams.append("popup", "false");

    try {
        const res = await fetch(GATEWAY_LOGIN, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": USER_AGENT,
            },
            body: loginParams,
        });
        const postHtml = await res.text();
        // Kiểm tra xem đã đăng nhập thành công chưa
        if (postHtml.toLowerCase().includes("success") || postHtml.toLowerCase().includes("logged in")) {
            console.log("\n[+] ĐĂNG NHẬP THÀNH CÔNG! Đã có Internet.");
        } else {
            const resultMatch = postHtml.match(/const\s+wifiInfo\s*=\s*(\{[\s\S]*?\})\s*;/);
            if (resultMatch) {
                const result = new Function("return " + resultMatch[1])();
                if (result["logged-in"] === "yes") {
                    console.log("\n[+] ĐĂNG NHẬP THÀNH CÔNG!");
                } else {
                    console.log("\n[-] Đăng nhập thất bại.");
                    if (result.error) console.log(`    Lỗi: ${result.error}`);
                }
            } else {
                console.log("\n[?] Không xác định được phản hồi từ Router, nhưng request đã được gửi đi.");
            }
        }
    } catch (e) {
        console.error("[-] Lỗi khi POST tới Router:", e.message);
    }
}

// Hàm chạy nền tự động
async function startAutoLogin() {
    // 1. Chạy lần đầu tiên ngay lập tức khi mở script
    await loginWifi();
    
    console.log(`\n[*] Hệ thống đang chạy ngầm. Chu kỳ tự động kiểm tra: ${INTERVAL_MINUTES} phút.`);
    
    async function runLoop() {
        let timeRemaining = Math.floor(INTERVAL_MS / 1000);
        
        // Bộ đếm thời gian động (Hiển thị đếm ngược trên cùng 1 dòng)
        const countdownTimer = setInterval(() => {
            timeRemaining--;
            if (timeRemaining > 0) {
                const m = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
                const s = (timeRemaining % 60).toString().padStart(2, '0');
                process.stdout.write(`\r[*] Đang chờ... Kiểm tra kết nối lại sau: ${m}:${s}   `);
            }
        }, 1000);

        // Đợi hết chu kỳ
        await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
        clearInterval(countdownTimer);
        
        process.stdout.write('\n'); // Xuống dòng
        console.log(`\n======================================================`);
        console.log(`[${new Date().toLocaleString()}] Đang chạy lại tiến trình tự động đăng nhập...`);
        
        await loginWifi();
        
        // Gọi lại vòng lặp mới
        runLoop();
    }
    
    runLoop();
}

startAutoLogin();
