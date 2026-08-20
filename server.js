"use strict";

const http = require("http");

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Heavy Lux Card — Online");
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(
        `Heavy Lux Card server started on port ${PORT}`
    );
});
