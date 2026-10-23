import { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import "./App.css";
import "./water.css"; // [เพิ่ม] สไตล์การ์ดระดับน้ำ
import "./light.css"; // [เพิ่ม] สไตล์การ์ดความสว่าง
import "./ph.css"; // [เพิ่ม] สไตล์การ์ด pH

// TODO: แก้เป็น HiveMQ Cloud cluster ของคุณ
// รูปแบบ: wss://<cluster-id>.s1.eu.hivemq.cloud:8884/mqtt
const DEFAULT_BROKER_URL = "wss://YOUR-CLUSTER-ID.s1.eu.hivemq.cloud:8884/mqtt";
const COMMAND_TOPIC = "farm/growlight/command";
const WATER_TOPIC = "farm/waterlevel/data"; // [เพิ่ม]
const WATER_STALE_MS = 15000; // [เพิ่ม] ไม่มีข้อมูลเกิน 15 วินาที = ถือว่าเก่า
const LIGHT_TOPIC = "farm/light/data"; // [เพิ่ม] VEML7700
const LIGHT_STALE_MS = 15000; // [เพิ่ม]
const PH_TOPIC = "farm/ph/data"; // [เพิ่ม] PH-4502C
const PH_STALE_MS = 15000; // [เพิ่ม]
const LIGHT_LEVEL_LABELS = ["มืด", "สลัว", "ปกติ", "สว่าง", "สว่างมาก"]; // [เพิ่ม] ต้องตรงกับ light_sensor.h

const PRESETS = [0, 50, 128, 191, 255];

function toPercentage(pwm) {
  return Number(((pwm / 255) * 100).toFixed(1));
}

export default function App() {
  const [brokerUrl, setBrokerUrl] = useState(DEFAULT_BROKER_URL);
  const [mqttUsername, setMqttUsername] = useState("");
  const [mqttPassword, setMqttPassword] = useState("");
  const [connectConfig, setConnectConfig] = useState(null); // {url, username, password} actually connected with
  const [status, setStatus] = useState("disconnected");
  const [pwm, setPwm] = useState(128);
  const [lastMessage, setLastMessage] = useState(null);
  const [water, setWater] = useState(null); // [เพิ่ม] {mv, percent, receivedAt}
  const [light, setLight] = useState(null); // [เพิ่ม] {lux, receivedAt}
  const [ph, setPh] = useState(null); // [เพิ่ม] {value, v, receivedAt}
  const [now, setNow] = useState(Date.now()); // [เพิ่ม] ใช้เช็คว่าข้อมูลเก่าหรือยัง
  const clientRef = useRef(null);

  // [เพิ่ม] อัปเดตเวลาทุก 1 วินาที
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!connectConfig) return;

    setStatus("connecting");
    const client = mqtt.connect(connectConfig.url, {
      clientId: `growlight-web-${Date.now()}`,
      username: connectConfig.username || undefined,
      password: connectConfig.password || undefined,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 8000,
    });
    clientRef.current = client;

    client.on("connect", () => {
      setStatus("connected");
      // [เพิ่ม] subscribe ทุกครั้งที่เชื่อมต่อ (รวมถึงตอน reconnect)
      client.subscribe([WATER_TOPIC, LIGHT_TOPIC, PH_TOPIC], { qos: 0 }, (err) => {
        if (err) console.error("Subscribe error:", err);
      });
    });
    client.on("reconnect", () => setStatus("reconnecting"));
    client.on("close", () => setStatus("disconnected"));
    client.on("error", (err) => {
      console.error("MQTT error:", err);
      setStatus("error");
    });

    // [เพิ่ม] รับข้อมูลเซนเซอร์จาก ESP32 (ระดับน้ำ + แสง)
    client.on("message", (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (topic === WATER_TOPIC) {
          setWater({
            mv: Number(data.mv),
            percent: Number(data.percent),
            receivedAt: Date.now(),
          });
        } else if (topic === PH_TOPIC) {
          const valid = data.valid === undefined ? true : Number(data.valid) === 1;
          setPh({
            value: valid ? Number(data.ph) : null,
            v: Number(data.v),
            receivedAt: Date.now(),
          });
        } else if (topic === LIGHT_TOPIC) {
          setLight({
            lux: Number(data.lux),
            level: data.level === undefined ? null : Number(data.level),
            receivedAt: Date.now(),
          });
        }
      } catch (err) {
        console.error("Sensor payload parse error:", err);
      }
    });

    return () => {
      client.end(true);
      clientRef.current = null;
    };
  }, [connectConfig]);

  const handleConnect = () => {
    if (clientRef.current) {
      clientRef.current.end(true);
      clientRef.current = null;
    }
    setConnectConfig({ url: brokerUrl, username: mqttUsername, password: mqttPassword });
  };

  const sendPWM = () => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      window.alert("MQTT ยังไม่ได้เชื่อมต่อ");
      return;
    }

    const payload = {
      action: "set_pwm",
      value: pwm,
      percentage: toPercentage(pwm),
      timestamp: new Date().toISOString(),
    };

    client.publish(COMMAND_TOPIC, JSON.stringify(payload), { qos: 0 }, (err) => {
      if (err) {
        console.error("Publish error:", err);
        return;
      }
      setLastMessage(payload);
    });
  };

  const percentage = toPercentage(pwm);
  const statusLabel = {
    disconnected: "ยังไม่เชื่อมต่อ",
    connecting: "กำลังเชื่อมต่อ…",
    connected: "เชื่อมต่อแล้ว",
    reconnecting: "กำลังเชื่อมต่อใหม่…",
    error: "เชื่อมต่อไม่สำเร็จ",
  }[status];

  // [เพิ่ม] คำนวณสถานะการ์ดระดับน้ำ
  const waterAgeSec = water ? Math.round((now - water.receivedAt) / 1000) : null;
  const waterStale = water ? now - water.receivedAt > WATER_STALE_MS : true;
  const waterPercent = water ? Math.min(100, Math.max(0, water.percent)) : 0;

  // [เพิ่ม] คำนวณสถานะการ์ดแสง (แถบใช้สเกล log เพราะ lux มีช่วงกว้างมาก 0-100,000)
  const lightAgeSec = light ? Math.round((now - light.receivedAt) / 1000) : null;
  const lightStale = light ? now - light.receivedAt > LIGHT_STALE_MS : true;
  // [เพิ่ม] คำนวณสถานะการ์ด pH (แถบ 0-14)
  const phAgeSec = ph ? Math.round((now - ph.receivedAt) / 1000) : null;
  const phStale = ph ? now - ph.receivedAt > PH_STALE_MS : true;
  const phBar = ph && ph.value !== null ? Math.min(100, Math.max(0, (ph.value / 14) * 100)) : 0;

  const lightBar = light
    ? Math.min(100, Math.max(0, (Math.log10(Math.max(light.lux, 0) + 1) / 5) * 100))
    : 0;

  return (
    <div className="page">
      <main className="panel">
        <header className="panel-header">
          <h1>Grow Light Test</h1>
          <p className="subtitle">ส่งค่า PWM ไปยัง MQTT Broker เพื่อทดสอบ</p>
        </header>

        <section className="broker-row">
          <label className="field-label" htmlFor="broker-url">
            MQTT Broker (WebSocket URL)
          </label>
          <div className="broker-input-row">
            <input
              id="broker-url"
              type="text"
              value={brokerUrl}
              onChange={(e) => setBrokerUrl(e.target.value)}
              placeholder="wss://xxxx.s1.eu.hivemq.cloud:8884/mqtt"
            />
          </div>

          <div className="auth-row">
            <input
              type="text"
              value={mqttUsername}
              onChange={(e) => setMqttUsername(e.target.value)}
              placeholder="username"
              autoComplete="off"
            />
            <input
              type="password"
              value={mqttPassword}
              onChange={(e) => setMqttPassword(e.target.value)}
              placeholder="password"
              autoComplete="off"
            />
          </div>

          <button type="button" className="btn-connect btn-connect-full" onClick={handleConnect}>
            เชื่อมต่อ
          </button>
          <div className="status-row">
            <span className={`status-dot status-${status}`} />
            <span className="status-text">{statusLabel}</span>
          </div>
        </section>

        <section className="control">
          <div className="readout">
            <span className="readout-value">{percentage}%</span>
            <span className="readout-unit">brightness</span>
          </div>

          <input
            className="slider"
            type="range"
            min="0"
            max="255"
            value={pwm}
            onChange={(e) => setPwm(Number(e.target.value))}
            style={{ "--fill": `${percentage}%` }}
            aria-label="PWM value"
          />
          <div className="pwm-value">PWM: {pwm} / 255</div>

          <div className="preset-row">
            {PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                className={`preset-btn ${pwm === value ? "active" : ""}`}
                onClick={() => setPwm(value)}
              >
                {toPercentage(value)}%
              </button>
            ))}
          </div>

          <button type="button" className="send-btn" onClick={sendPWM}>
            ส่งค่า PWM
          </button>
        </section>

        {/* [เพิ่ม] การ์ดแสดงระดับน้ำ */}
        <section className="water">
          <h2>ระดับน้ำ</h2>
          <div className="water-readout">
            <span className={`water-value ${waterStale ? "stale" : ""}`}>
              {water ? `${waterPercent.toFixed(1)}%` : "--"}
            </span>
            <span className="water-unit">water level</span>
          </div>
          <div className="water-bar">
            <div
              className={`water-bar-fill ${waterStale ? "stale" : ""}`}
              style={{ width: `${waterPercent}%` }}
            />
          </div>
          <div className="water-meta">
            <span>{water ? `${water.mv} mV` : "รอข้อมูล…"}</span>
            <span>
              {water
                ? waterStale
                  ? `ข้อมูลเก่า (${waterAgeSec} วินาทีที่แล้ว)`
                  : `อัปเดต ${waterAgeSec} วินาทีที่แล้ว`
                : ""}
            </span>
          </div>
          <p className="topic-note">
            topic: <code>{WATER_TOPIC}</code>
          </p>
        </section>

        {/* [เพิ่ม] การ์ดแสดงความสว่าง */}
        <section className="light">
          <h2>ความสว่าง</h2>
          <div className="light-readout">
            <span className={`light-value ${lightStale ? "stale" : ""}`}>
              {light ? light.lux.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "--"}
            </span>
            <span className="light-unit">lux</span>
          </div>
          <div className={`light-label ${lightStale ? "stale" : ""}`}>
            {light && light.level !== null ? LIGHT_LEVEL_LABELS[light.level] ?? "—" : "—"}
          </div>
          <div className="light-bar">
            <div
              className={`light-bar-fill ${lightStale ? "stale" : ""}`}
              style={{ width: `${lightBar}%` }}
            />
          </div>
          <div className="light-meta">
            <span>{light ? "VEML7700" : "รอข้อมูล…"}</span>
            <span>
              {light
                ? lightStale
                  ? `ข้อมูลเก่า (${lightAgeSec} วินาทีที่แล้ว)`
                  : `อัปเดต ${lightAgeSec} วินาทีที่แล้ว`
                : ""}
            </span>
          </div>
          <p className="topic-note">
            topic: <code>{LIGHT_TOPIC}</code>
          </p>
        </section>

        {/* [เพิ่ม] การ์ดแสดงค่า pH */}
        <section className="ph">
          <h2>ค่า pH</h2>
          <div className="ph-readout">
            <span className={`ph-value ${phStale ? "stale" : ""}`}>
              {ph && ph.value !== null ? ph.value.toFixed(2) : "--"}
            </span>
            <span className="ph-unit">pH</span>
          </div>
          <div className="ph-bar">
            <div
              className={`ph-bar-fill ${phStale ? "stale" : ""}`}
              style={{ width: `${phBar}%` }}
            />
          </div>
          <div className="ph-meta">
            <span>
              {ph
                ? ph.value === null
                  ? `ไม่พบสัญญาณ (${ph.v.toFixed(3)} V)`
                  : `${ph.v.toFixed(3)} V`
                : "รอข้อมูล…"}
            </span>
            <span>
              {ph
                ? phStale
                  ? `ข้อมูลเก่า (${phAgeSec} วินาทีที่แล้ว)`
                  : `อัปเดต ${phAgeSec} วินาทีที่แล้ว`
                : ""}
            </span>
          </div>
          <p className="topic-note">
            topic: <code>{PH_TOPIC}</code>
          </p>
        </section>

        <section className="message">
          <h2>ข้อความล่าสุดที่ส่ง</h2>
          {lastMessage ? (
            <pre>{JSON.stringify(lastMessage, null, 2)}</pre>
          ) : (
            <p className="empty">ยังไม่มีข้อความที่ส่งออกไป</p>
          )}
          <p className="topic-note">
            topic: <code>{COMMAND_TOPIC}</code>
          </p>
        </section>
      </main>
    </div>
  );
}