package edu.tecsup.semaforoplus.iot.service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class UdpVideoService {
    private static final Logger log = LoggerFactory.getLogger(UdpVideoService.class);
    private static final long ANNOTATED_TTL_MS = 4000L;

    @Value("${udp.video-port:5005}")
    private int videoPort;

    private final Map<String, byte[]> rawFrames = new ConcurrentHashMap<>();
    private final Map<String, byte[]> annotatedFrames = new ConcurrentHashMap<>();
    private final Map<String, Long> annotatedTimestamps = new ConcurrentHashMap<>();
    private final Map<String, Long> rawTimestamps = new ConcurrentHashMap<>();
    private final Map<String, FrameAssembly> assemblies = new ConcurrentHashMap<>();

    private volatile boolean running = true;
    private DatagramSocket socket;
    private Thread receiverThread;

    private static class FrameAssembly {
        final int frameId;
        final int totalParts;
        final byte[][] parts;
        int receivedParts = 0;

        FrameAssembly(int frameId, int totalParts) {
            this.frameId = frameId;
            this.totalParts = totalParts;
            this.parts = new byte[totalParts][];
        }
    }

    @PostConstruct
    public void start() {
        receiverThread = new Thread(this::receiveLoop, "udp-video-receiver");
        receiverThread.setDaemon(true);
        receiverThread.start();
    }

    @PreDestroy
    public void stop() {
        running = false;
        if (socket != null && !socket.isClosed()) {
            socket.close();
        }
    }

    private void receiveLoop() {
        try {
            socket = new DatagramSocket(videoPort);
            socket.setReceiveBufferSize(1024 * 1024);
            byte[] buffer = new byte[2048];
            log.info("UDP video receiver listening on port {}", videoPort);
            while (running) {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                socket.receive(packet);
                processPacket(packet.getData(), packet.getLength());
            }
        } catch (Exception e) {
            if (running) {
                log.warn("UDP receiver stopped: {}", e.getMessage());
            }
        }
    }

    private void processPacket(byte[] data, int length) {
        if (length < 12) {
            return;
        }
        String camId = new String(data, 0, 6, StandardCharsets.US_ASCII).trim();
        int frameId = ((data[6] & 0xFF) << 8) | (data[7] & 0xFF);
        int partIndex = data[8] & 0xFF;
        int totalParts = data[9] & 0xFF;
        int chunkLen = ((data[10] & 0xFF) << 8) | (data[11] & 0xFF);

        if (totalParts <= 0 || partIndex >= totalParts || length < 12 + chunkLen) {
            return;
        }

        String key = camId + ":" + frameId;
        FrameAssembly assembly = assemblies.compute(key, (k, existing) -> {
            if (existing == null || existing.frameId != frameId) {
                return new FrameAssembly(frameId, totalParts);
            }
            return existing;
        });

        if (assembly.parts[partIndex] == null) {
            byte[] chunk = new byte[chunkLen];
            System.arraycopy(data, 12, chunk, 0, chunkLen);
            assembly.parts[partIndex] = chunk;
            assembly.receivedParts++;
        }

        if (assembly.receivedParts == assembly.totalParts) {
            assemblies.remove(key);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            for (byte[] part : assembly.parts) {
                if (part != null) {
                    out.write(part, 0, part.length);
                }
            }
            saveRawFrame(camId, out.toByteArray());
        }

        if (assemblies.size() > 32) {
            assemblies.clear();
        }
    }

    public void saveRawFrame(String camId, byte[] jpegBytes) {
        if (jpegBytes == null || jpegBytes.length == 0) {
            return;
        }
        rawFrames.put(camId, jpegBytes);
        rawTimestamps.put(camId, Instant.now().toEpochMilli());
    }

    public void saveAnnotatedFrame(String camId, byte[] jpegBytes) {
        if (jpegBytes == null || jpegBytes.length == 0) {
            return;
        }
        annotatedFrames.put(camId, jpegBytes);
        annotatedTimestamps.put(camId, Instant.now().toEpochMilli());
    }

    public byte[] getRawFrame(String camId) {
        return rawFrames.get(camId);
    }

    public byte[] getLiveFrame(String camId) {
        Long annotatedAt = annotatedTimestamps.get(camId);
        if (annotatedAt != null && (Instant.now().toEpochMilli() - annotatedAt) < ANNOTATED_TTL_MS) {
            byte[] frame = annotatedFrames.get(camId);
            if (frame != null) {
                return frame;
            }
        }
        return rawFrames.get(camId);
    }

    public boolean hasRecentFrame(String camId, long ttlMs) {
        Long ts = rawTimestamps.get(camId);
        return ts != null && (Instant.now().toEpochMilli() - ts) < ttlMs;
    }
}
