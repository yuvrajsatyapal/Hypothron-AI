import { createServer } from "node:net";
for (const port of [3000, 3001, 8000]) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", () => reject(new Error("CI_PORT_OCCUPIED_" + port)));
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => server.close(resolve));
}
console.log("Test-owned localhost ports available");
