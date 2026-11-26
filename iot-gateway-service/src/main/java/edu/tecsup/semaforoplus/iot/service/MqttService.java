package edu.tecsup.semaforoplus.iot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.tecsup.semaforoplus.iot.dto.Esp32CentralPayload;
import edu.tecsup.semaforoplus.iot.dto.TrafficControlPayload;
import edu.tecsup.semaforoplus.iot.model.TrafficNodeStatus;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.eclipse.paho.client.mqttv3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@Service
public class MqttService {
    private static final Logger log = LoggerFactory.getLogger(MqttService.class);

    @Value("${mqtt.broker-url:tcp://localhost:1883}")
    private String brokerUrl;

    @Value("${mqtt.client-id:semaforoplus-iot-gateway}")
    private String clientId;

    @Value("${mqtt.topic-prefix:semaforoplus/node-01}")
    private String topicPrefix;

    @Value("${mqtt.username:}")
    private String username;

    @Value("${mqtt.password:}")
    private String password;

    private final HardwareStateService hardwareStateService;
    private final ObjectMapper objectMapper;
    private MqttClient client;

    public MqttService(HardwareStateService hardwareStateService, ObjectMapper objectMapper) {
        this.hardwareStateService = hardwareStateService;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void connect() {
        try {
            client = new MqttClient(brokerUrl, clientId + "-" + System.currentTimeMillis());
            MqttConnectOptions opts = new MqttConnectOptions();
            opts.setAutomaticReconnect(true);
            opts.setCleanSession(true);
            opts.setConnectionTimeout(5);
            if (username != null && !username.isBlank()) {
                opts.setUserName(username);
                opts.setPassword(password.toCharArray());
            }

            client.setCallback(new MqttCallbackExtended() {
                @Override
                public void connectComplete(boolean reconnect, String serverURI) {
                    subscribeTopics();
                }

                @Override
                public void connectionLost(Throwable cause) {
                    log.warn("MQTT connection lost: {}", cause != null ? cause.getMessage() : "unknown");
                }

                @Override
                public void messageArrived(String topic, MqttMessage message) {
                    handleIncoming(topic, new String(message.getPayload(), StandardCharsets.UTF_8));
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {}
            });

            client.connect(opts);
            subscribeTopics();
            log.info("Connected to MQTT broker at {}", brokerUrl);
        } catch (Exception e) {
            log.warn("MQTT broker unavailable at {}: {}", brokerUrl, e.getMessage());
        }
    }

    @PreDestroy
    public void disconnect() {
        try {
            if (client != null && client.isConnected()) {
                client.disconnect();
                client.close();
            }
        } catch (Exception ignored) {}
    }

    private void subscribeTopics() {
        try {
            if (client != null && client.isConnected()) {
                client.subscribe(topicPrefix + "/central/telemetry", 0);
                client.subscribe(topicPrefix + "/central/status", 1);
            }
        } catch (Exception e) {
            log.warn("Failed to subscribe MQTT topics: {}", e.getMessage());
        }
    }

    private void handleIncoming(String topic, String payload) {
        try {
            if (topic.endsWith("/central/telemetry")) {
                Esp32CentralPayload dto = objectMapper.readValue(payload, Esp32CentralPayload.class);
                hardwareStateService.updateEsp32Telemetry(dto);
            } else if (topic.endsWith("/central/status")) {
                hardwareStateService.markEsp32Status(payload.trim());
            }
        } catch (Exception e) {
            log.debug("Failed to process MQTT message on {}: {}", topic, e.getMessage());
        }
    }

    public void publishTrafficCommand(TrafficControlPayload payload) {
        try {
            if (client != null && client.isConnected()) {
                String json = objectMapper.writeValueAsString(payload);
                MqttMessage msg = new MqttMessage(json.getBytes(StandardCharsets.UTF_8));
                msg.setQos(1);
                msg.setRetained(false);
                client.publish(topicPrefix + "/central/command", msg);
            }
        } catch (Exception e) {
            log.debug("Failed to publish MQTT command: {}", e.getMessage());
        }
    }

    @Scheduled(fixedRate = 1000)
    public void publishDisplayState() {
        try {
            if (client == null || !client.isConnected()) {
                return;
            }
            TrafficNodeStatus node = hardwareStateService.getNodeStatus();
            var sem1 = node.trafficLights().get(0);
            var sem2 = node.trafficLights().get(1);
            var cam1 = node.cameras().get(0);
            var cam2 = node.cameras().get(1);

            Map<String, Object> displayPayload = Map.of(
                    "sem1State", sem1.currentState().name(),
                    "sem2State", sem2.currentState().name(),
                    "sem1Remaining", sem1.remainingSeconds(),
                    "sem2Remaining", sem2.remainingSeconds(),
                    "emergency", node.activeEmergencyPriority(),
                    "cam1Vehicles", cam1.classification().totalVehicles(),
                    "cam2Vehicles", cam2.classification().totalVehicles()
            );

            String json = objectMapper.writeValueAsString(displayPayload);
            MqttMessage msg = new MqttMessage(json.getBytes(StandardCharsets.UTF_8));
            msg.setQos(0);
            msg.setRetained(true);
            client.publish(topicPrefix + "/display/state", msg);
        } catch (Exception ignored) {}
    }
}
