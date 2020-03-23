"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const state_1 = __importDefault(require("./state"));
const exception_1 = __importDefault(require("./metadata/exception"));
const logging_1 = __importDefault(require("./logging"));
class RequestCatcher {
    //private app: express.Application;
    attach(app) {
        logging_1.default('Attached to express instance');
        //this.app = app;
        // Attach the router first, so we don't deal with calls to ourselves
        app.use('/_debug/', this.getRouter());
        // Use `bind` to preserve `this`
        app.use(this.middleware.bind(this));
    }
    middleware(req, res, next) {
        logging_1.default('Catched a request');
        const transaction = state_1.default.registerTransaction(req, res);
        // Hacky hack to inject extra fields in the request
        const metadataInjector = req;
        metadataInjector.debugMetadata = {};
        metadataInjector.transaction = transaction;
        // Hook the send() call
        const oldSend = res.send;
        res.send = (...args) => {
            transaction.setStatus(res.statusCode);
            //Compatability with the pre express 4 way of doing it
            if (args.length == 2) {
                if (typeof args[0] === "number") {
                    transaction.setResponse(args[1]);
                }
                else {
                    transaction.setResponse(args[0]);
                }
            }
            else {
                transaction.setResponse(args[0]);
            }
            transaction.setHeaders(res.getHeaders());
            transaction.setDidComplete(true);
            return oldSend.apply(res, args);
        };
        const oldJson = res.json;
        res.json = (...args) => {
            transaction.setStatus(res.statusCode);
            transaction.setResponse(args[0]);
            transaction.setHeaders(res.getHeaders());
            transaction.setDidComplete(true);
            return oldJson.apply(res, args);
        };
        try {
            next();
        }
        catch (e) {
            logging_1.default(`Request failed: ${e}`);
            transaction.attachMetadata(new exception_1.default(e));
        }
        transaction.finalize();
        logging_1.default('Request is handled');
    }
    getRouter() {
        const route = express_1.default.Router();
        route.use(express_1.default.static(__dirname + '/frontend'));
        route.use('/api', state_1.default.getRestApiRouter());
        route.use((req, res, next) => {
            res.sendFile(__dirname + '/frontend/index.html');
        });
        return route;
    }
}
const DebugToolbar = new RequestCatcher();
exports.default = DebugToolbar;
