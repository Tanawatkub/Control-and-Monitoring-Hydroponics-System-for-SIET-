// notifications/line_notify.js

// ฟังก์ชันสำหรับส่งข้อความแจ้งเตือนเข้า LINE OA โดยใช้ Messaging API
async function sendLineNotification(userId, message) {
    // TODO: นำ Channel Access Token จากเว็บ LINE Developers มาใส่ตรงนี้ในภายหลัง
    const LINE_ACCESS_TOKEN = "ใส่_CHANNEL_ACCESS_TOKEN_ของคุณที่นี่";
    
    const url = "https://api.line.me/v2/bot/message/push";
    
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LINE_ACCESS_TOKEN}`
    };
    
    const body = JSON.stringify({
        to: userId,
        messages: [
            {
                type: "text",
                text: message
            }
        ]
    });

    try {
        const response = await fetch(url, { method: 'POST', headers: headers, body: body });
        if (response.ok) {
            console.log("ส่งข้อความแจ้งเตือนสำเร็จ!");
        } else {
            const errorData = await response.json();
            console.error("ส่งข้อความล้มเหลว:", errorData);
        }
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการเชื่อมต่อ API:", error);
    }
}

// --- ส่วนทดสอบระบบ (นำ Mock Data มาจำลองการทำงาน) ---
// สมมติว่าดึงข้อมูลจำลองมาจาก sensor_mock.json แล้วพบว่าค่า pH สูงเกินเกณฑ์
const alertMessage = "⚠️ ระบบแจ้งเตือนฉุกเฉิน!\nอุปกรณ์: ESP32-MAC-001\nปัญหา: พบค่า pH สูงเกินเกณฑ์ (8.2)\nกรุณาตรวจสอบระบบน้ำด่วนครับ";

// TODO: ใส่ User ID ของคุณเพื่อทดสอบการรับข้อความในภายหลัง
const testUserId = "ใส่_LINE_USER_ID_ของคุณที่นี่";

// ทดลองเรียกใช้ฟังก์ชัน (เอาเครื่องหมาย // ข้างหน้าออกเมื่อได้ Token แล้วและต้องการรันจริง)
// sendLineNotification(testUserId, alertMessage);

module.exports = { sendLineNotification };