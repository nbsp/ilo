import { createNodeMiddleware, createProbot } from "probot";

import app from "../../..";
const probot = createProbot();

export default createNodeMiddleware(app, { probot, webhooksPath: '/api/github/webhooks' });
