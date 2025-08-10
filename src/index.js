import express from "express";
import { Server } from "socket.io";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import Docker from "dockerode";
import { Writable } from "node:stream";
const docker = new Docker({
  socketPath: "/var/run/docker.sock",
});
const activeStreams = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server);

app.get("/", async (req, res) => {
  return res.sendFile("index.html");
});

app.get("/containers", async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: false });
    return res.send(
      containers.map((c) => {
        return {
          Id: c.Id,
          name: c.Names.map((name) => name.replace(/^\//, ""))[0],
        };
      })
    );
  } catch (error) {
    return res.status(500).send(error.message);
  }
});
const streamLog = async (container_id, socket, onStreamReady) => {
  try {
    const container = docker.getContainer(container_id);
    if (!container) throw new Error("Container Not Found");

    container.logs(
      {
        follow: true,
        stdout: true,
        stderr: true,
      },
      (error, stream) => {
        if (error) throw error;

        // Provide stream to caller for cleanup
        onStreamReady?.(stream);

        const stdoutStream = new Writable({
          write(chunk, encoding, callback) {
            const line = chunk.toString("utf-8").trimEnd();
            socket.emit("stream-logs", { line, type: "log" });
            callback();
          },
        });

        const stderrStream = new Writable({
          write(chunk, encoding, callback) {
            const line = chunk.toString("utf-8").trimEnd();
            socket.emit("stream-logs", { line, type: "error" });
            callback();
          },
        });

        container.modem.demuxStream(stream, stdoutStream, stderrStream);

        socket.on("disconnect", () => {
          console.log(`Client ${socket.id} disconnected`);
          stream.destroy(); // Important cleanup
        });
      }
    );
  } catch (error) {
    console.error(error);
    socket.emit("stream-logs", { line: error.message, type: "error" });
  }
};

io.on("connection", (socket) => {
  console.log("Client Connected", socket.id);

  socket.on("container-logs", ({ container_id }) => {
    // Clean up old stream if it exists
    if (activeStreams.has(socket.id)) {
      const oldStream = activeStreams.get(socket.id);
      oldStream.destroy();
      activeStreams.delete(socket.id);
    }

    // Stream new logs and track the stream
    streamLog(container_id, socket, (logStream) => {
      activeStreams.set(socket.id, logStream);
    });
  });

  socket.on("disconnect", () => {
    // Clean up on disconnect
    if (activeStreams.has(socket.id)) {
      activeStreams.get(socket.id).destroy();
      activeStreams.delete(socket.id);
    }
    console.log(`Client ${socket.id} disconnected`);
  });
});

server.listen(4000, () => {
  console.log("Server Started on PORT 4000");
});
