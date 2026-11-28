package edu.tecsup.semaforoplus.iot.controller;

import edu.tecsup.semaforoplus.iot.model.Esp32CamStatus;
import edu.tecsup.semaforoplus.iot.model.TrafficLightStatus;
import edu.tecsup.semaforoplus.iot.model.TrafficNodeStatus;
import edu.tecsup.semaforoplus.iot.service.HardwareStateService;
import edu.tecsup.semaforoplus.iot.service.UdpVideoService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/realtime")
public class RealtimeController {
    private final HardwareStateService hardwareStateService;
    private final UdpVideoService udpVideoService;

    public RealtimeController(HardwareStateService hardwareStateService, UdpVideoService udpVideoService) {
        this.hardwareStateService = hardwareStateService;
        this.udpVideoService = udpVideoService;
    }

    @GetMapping("/node")
    public ResponseEntity<TrafficNodeStatus> getNode() {
        return ResponseEntity.ok(hardwareStateService.getNodeStatus());
    }

    @GetMapping("/cameras")
    public ResponseEntity<List<Esp32CamStatus>> getCameras() {
        return ResponseEntity.ok(hardwareStateService.getNodeStatus().cameras());
    }

    @GetMapping("/traffic-lights")
    public ResponseEntity<List<TrafficLightStatus>> getTrafficLights() {
        return ResponseEntity.ok(hardwareStateService.getNodeStatus().trafficLights());
    }

    @PostMapping("/emergency-trigger")
    public ResponseEntity<Map<String, Object>> triggerEmergency(@RequestParam(defaultValue = "CAM-01") String camId) {
        hardwareStateService.triggerEmergency(camId);
        return ResponseEntity.ok(Map.of("status", "emergency_triggered", "camId", camId));
    }

    @PostMapping("/emergency-reset")
    public ResponseEntity<Map<String, Object>> resetEmergency() {
        hardwareStateService.resetEmergency();
        return ResponseEntity.ok(Map.of("status", "emergency_cleared"));
    }

    @PostMapping(value = "/cam/{camId}/annotated-frame", consumes = MediaType.ALL_VALUE)
    public ResponseEntity<Void> uploadAnnotatedFrame(@PathVariable String camId, @RequestBody byte[] jpegBytes) {
        udpVideoService.saveAnnotatedFrame(camId, jpegBytes);
        return ResponseEntity.ok().build();
    }

    @GetMapping(value = "/cam/{camId}/raw.jpg", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> getRawFrame(@PathVariable String camId) {
        byte[] frame = udpVideoService.getRawFrame(camId);
        if (frame == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).body(frame);
    }

    @GetMapping(value = "/cam/{camId}/live.jpg", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> getLiveFrame(@PathVariable String camId) {
        byte[] frame = udpVideoService.getLiveFrame(camId);
        if (frame == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).body(frame);
    }

    @GetMapping("/cam/{camId}/stream")
    public void streamMjpeg(@PathVariable String camId, HttpServletResponse response) {
        response.setContentType("multipart/x-mixed-replace; boundary=frame");
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        try (OutputStream out = response.getOutputStream()) {
            byte[] lastFrame = null;
            while (!Thread.currentThread().isInterrupted()) {
                byte[] frame = udpVideoService.getLiveFrame(camId);
                if (frame != null && frame != lastFrame) {
                    lastFrame = frame;
                    String header = "--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + frame.length + "\r\n\r\n";
                    out.write(header.getBytes(StandardCharsets.US_ASCII));
                    out.write(frame);
                    out.write("\r\n".getBytes(StandardCharsets.US_ASCII));
                    out.flush();
                }
                Thread.sleep(40);
            }
        } catch (Exception ignored) {}
    }
}
