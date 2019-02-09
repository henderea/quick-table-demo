class EventEmitter {
    constructor() {
        this._listeners = {};
    }

    get listeners() { return this._listeners; }

    on(event, handler) {
        if(!this.listeners[event]) { this.listeners[event] = []; }
        this.listeners[event].push(handler);
        return this;
    }

    trigger(event, ...args) {
        if(this.listeners[event] && this.listeners[event].length > 0) {
            _.each(this.listeners[event], handler => {
                handler(...args);
            });
        }
        return this;
    }
}

export { EventEmitter };