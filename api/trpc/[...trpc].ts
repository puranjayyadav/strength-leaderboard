import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Mount tRPC at the root since Vercel routes /api/trpc/* to this handler
app.use("/", (req, res, next) => {
    try {
        const middleware = createExpressMiddleware({
            router: appRouter,
            createContext,
        });
        return middleware(req, res, next);
    } catch (error) {
        console.error("[API] tRPC initialization error:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Remove /api/trpc prefix from the URL for express routing
    const originalUrl = req.url || '';
    req.url = originalUrl.replace(/^\/api\/trpc/, '') || '/';

    return new Promise((resolve, reject) => {
        app(req as any, res as any, (err: any) => {
            if (err) {
                console.error("[Vercel tRPC Handler] Error:", err);
                reject(err);
            } else {
                resolve(undefined);
            }
        });
    });
}
