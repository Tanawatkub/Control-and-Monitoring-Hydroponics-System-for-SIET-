import { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import "./App.css";

// TODO: แก้เป็น HiveMQ Cloud cluster ของคุณ
// รูปแบบ: wss://<cluster-id>.s1.eu.hivemq.cloud:8884/mqtt
const DEFAULT_BROKER_URL = "wss://YOUR-CLUSTER-ID.s1.eu.hivemq.cloud:8884/mqtt";
const COMMAND_TOPIC = "farm/growlight/command";

const PRESETS = [0, 64, 128, 191, 255];

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
  const clientRef = useRef(null);

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

    client.on("connect", () => setStatus("connected"));
    client.on("reconnect", () => setStatus("reconnecting"));
    client.on("close", () => setStatus("disconnected"));
    client.on("error", (err) => {
      console.error("MQTT error:", err);
      setStatus("error");
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
