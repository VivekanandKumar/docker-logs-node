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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server);

app.get("/", async (req, res) => {
  return res.sendFile("index.html");
});

io.on("connection", async (socket) => {
  console.log("Client Connected", socket.id);

  const container = docker.getContainer("7bef7ba7cf66");
  container.logs(
    {
      follow: true,
      stdout: true,
      stderr: true,
    },
    (err, stream) => {
      if (err) {
        console.error("Error fetching logs:", err);
        return;
      }

      // Create writable stream for stdout
      const stdoutStream = new Writable({
        write(chunk, encoding, callback) {
          const line = chunk.toString("utf-8").trimEnd();
          socket.emit("stream-logs", { line, type: "log" }); // send to client
          callback();
        },
      });

      // Same for stderr
      const stderrStream = new Writable({
        write(chunk, encoding, callback) {
          const line = chunk.toString("utf-8").trimEnd();
          socket.emit("stream-logs", { line, type: "error" });
          callback();
        },
      });

      // This is the key line: demux removes Docker's raw headers
      container.modem.demuxStream(stream, stdoutStream, stderrStream);

      socket.on("disconnect", () => {
        console.log(`Client ${socket.id} disconnected`);
        stream.destroy();
      });
    }
  );
});

server.listen(4000, () => {
  console.log("Server Started on PORT 4000");
});
