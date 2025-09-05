
export type Listener<T = any> = (data: T) => void;

export class EventEmitter {
    private events: Map<string, Listener[]> = new Map();

    // 添加事件监听器
    on<T = any>(event: string, listener: Listener<T>): void {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)!.push(listener);
    }

    // 移除事件监听器
    off<T = any>(event: string, listener: Listener<T>): void {
        if (this.events.has(event)) {
            this.events.set(event, this.events.get(event)!.filter(l => l !== listener));
        }
    }

    // 触发事件（调用所有监听器）
    emit<T = any>(event: string, data?: T): boolean {
        if (this.events.has(event)) {
            this.events.get(event)!.forEach(listener => listener(data));
            return true
        } else {
            return false
        }
    }
}
