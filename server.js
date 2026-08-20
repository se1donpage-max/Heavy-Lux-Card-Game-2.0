"use strict";

const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT) || 10000;
const HOST = "0.0.0.0";

const PUBLIC_DIR = path.join(__dirname, "public");
const INDEX_FILE = path.join(PUBLIC_DIR, "index.html");

const app = express();

app.disable("x-powered-by");

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: false
    })
);

const server = http.createServer(app);

const io = new Server(
    server,
    {
        cors: {
            origin: true,
            credentials: true
        },

        transports: [
            "websocket",
            "polling"
        ],

        connectionStateRecovery: {
            maxDisconnectionDuration:
                2 * 60 * 1000,

            skipMiddlewares:
                true
        }
    }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/health",
    (_req, res) => {

        res.status(200).json({
            ok: true,
            service: "heavy-lux-card",
            version: "2.0.1",
            socket: true
        });

    }
);


/* =========================================================
   FRONTEND
========================================================= */

app.use(
    express.static(
        PUBLIC_DIR,
        {
            index: "index.html",
            fallthrough: true,
            maxAge:
                process.env.NODE_ENV === "production"
                    ? "1h"
                    : 0
        }
    )
);


/* =========================================================
   SPA FALLBACK
========================================================= */

/*
Express 5 не используем со старым app.get("*").
Используем RegExp.
*/

app.get(
    /^(?!\/socket\.io)(?!\/health).*/,
    (_req, res) => {

        res.sendFile(
            INDEX_FILE
        );

    }
);


/* =========================================================
   SOCKET.IO
========================================================= */

io.on(
    "connection",
    socket => {

        console.log(
            `[Socket.IO] connected: ${socket.id}`
        );


        socket.emit(
            "connectionReady",
            {
                ok: true,

                socketId:
                    socket.id
            }
        );


        socket.on(
            "disconnect",
            reason => {

                console.log(
                    `[Socket.IO] disconnected: ${socket.id} (${reason})`
                );

            }
        );

    }
);


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (
        error,
        _req,
        res,
        _next
    ) => {

        console.error(
            "HTTP error:",
            error
        );


        if (
            res.headersSent
        ) {

            return;

        }


        res.status(500).json({
            ok: false,
            error:
                "Internal server error"
        });

    }
);


/* =========================================================
   START SERVER
========================================================= */

server.listen(
    PORT,
    HOST,
    () => {

        console.log(
            "================================================="
        );

        console.log(
            "HEAVY LUX CARD"
        );

        console.log(
            "================================================="
        );

        console.log(
            `Server started on ${HOST}:${PORT}`
        );

        console.log(
            `Frontend directory: ${PUBLIC_DIR}`
        );

        console.log(
            `Index file: ${INDEX_FILE}`
        );

        console.log(
            "Socket.IO: ready"
        );

        console.log(
            "================================================="
        );

    }
);


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

let shuttingDown =
    false;


function shutdown(
    signal
) {

    if (
        shuttingDown
    ) {

        return;

    }


    shuttingDown =
        true;


    console.log(
        `Received ${signal}. Shutting down...`
    );


    io.close(
        () => {

            server.close(
                () => {

                    process.exit(
                        0
                    );

                }
            );

        }
    );


    setTimeout(
        () => {

            process.exit(
                0
            );

        },
        10000
    ).unref();

}


process.on(
    "SIGTERM",
    () => {

        shutdown(
            "SIGTERM"
        );

    }
);


process.on(
    "SIGINT",
    () => {

        shutdown(
            "SIGINT"
        );

    }
);
