"use strict";

/*
=========================================================
HEAVY LUX CARD
SERVER
=========================================================

- Express
- HTTP
- Socket.IO
- Раздача frontend из /public
- Health check
- WebSocket connection
- Корректная работа на Render / Railway / VPS
=========================================================
*/

const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");


/* =========================================================
   CONFIG
========================================================= */

const PORT =
    Number(process.env.PORT) || 10000;

const HOST =
    "0.0.0.0";

const PUBLIC_DIR =
    path.join(
        __dirname,
        "public"
    );


/* =========================================================
   EXPRESS
========================================================= */

const app =
    express();

app.disable(
    "x-powered-by"
);

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


/* =========================================================
   HTTP SERVER
========================================================= */

const server =
    http.createServer(
        app
    );


/* =========================================================
   SOCKET.IO
========================================================= */

const io =
    new Server(
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
   FRONTEND
========================================================= */

/*
    Все файлы интерфейса должны находиться:

    public/
        index.html
        style.css
        app.js

    Express отдаёт их напрямую.
*/

app.use(
    express.static(
        PUBLIC_DIR,
        {
            index: "index.html"
        }
    )
);


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
    "/health",
    (_req, res) => {

        res.status(200).json({
            ok: true,
            service: "heavy-lux-card",
            socket: true
        });

    }
);


/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on(
    "connection",
    socket => {

        console.log(
            `[Socket.IO] connected: ${socket.id}`
        );


        /*
        Сообщаем frontend,
        что соединение успешно.
        */

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
   SPA FALLBACK
========================================================= */

/*
    Если frontend использует
    внутренние маршруты, возвращаем index.html.

    Важно: этот обработчик находится ПОСЛЕ
    express.static().
*/

app.get(
    "*",
    (_req, res) => {

        res.sendFile(
            path.join(
                PUBLIC_DIR,
                "index.html"
            )
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

function shutdown(
    signal
) {

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
