export interface LogViewerOptions {
  maxLines?: number;
  height?: string; // 新增高度选项
  backgroundColor?: string;
  textColor?: string;
  debugColor?: string;
  infoColor?: string;
  errorColor?: string;
  highlightColor?: string;
  filterLinesOnSearch?: boolean;
  showTimestamp?: boolean;
}

interface LogEntry {
  text: string;
  color?: string;
}

export class LogViewer {
  private container: HTMLElement;
  private logContainer!: HTMLDivElement; // 添加明确赋值断言
  private searchInput!: HTMLInputElement; // 添加明确赋值断言
  private lines: HTMLDivElement[] = [];
  private paused: boolean = false;
  private autoScroll: boolean = true;
  private maxLines: number;
  private height: string; // 控件高度
  private backgroundColor: string;
  private textColor: string;
  private debugColor: string;
  private infoColor: string;
  private errorColor: string;
  private highlightColor: string;
  private filterLinesOnSearch: boolean;
  private showTimestamp: boolean;
  private searchTerm: string = '';
  private originalLines: string[] = [];

  constructor(containerId: string, options: LogViewerOptions = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    this.container = container;
    
    this.maxLines = options.maxLines || 1000;
    this.height = options.height || '400px'; // 默认高度400px
    this.backgroundColor = options.backgroundColor || 'transparent';
    this.textColor = options.textColor || '#000000';
    this.debugColor = options.debugColor || '#666666';
    this.infoColor = options.infoColor || '#000000';
    this.errorColor = options.errorColor || '#ff0000';
    this.highlightColor = options.highlightColor || '#ffff00';
    this.filterLinesOnSearch = options.filterLinesOnSearch || false;
    this.showTimestamp = options.showTimestamp || false;

    this.initUI();
  }

  private initUI() {
    this.container.innerHTML = '';
    
    // 设置容器高度
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.height = this.height; // 应用高度选项
    this.container.style.overflow = 'hidden'; // 防止外部滚动
    
    this.createToolbar();
    this.createLogContainer();
    this.setupEventListeners();
  }

  private createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.style.padding = '8px';
    toolbar.style.display = 'flex';
    toolbar.style.gap = '8px';
    toolbar.style.backgroundColor = '#f0f0f0';
    toolbar.style.alignItems = 'center';
    toolbar.style.flexShrink = '0'; // 防止工具栏压缩

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search logs...';
    this.searchInput.style.flex = '1';
    this.searchInput.style.padding = '4px 8px';
    this.searchInput.style.border = '1px solid #ccc';
    this.searchInput.style.borderRadius = '4px';

    const copyButton = this.createButton('Copy All', this.copyAll.bind(this));
    const clearButton = this.createButton('Clear', this.clearLogs.bind(this));
    const pauseButton = this.createButton('Pause Scroll', this.togglePause.bind(this));
    const exportButton = this.createButton('Export File', this.exportFile.bind(this));

    toolbar.appendChild(this.searchInput);
    toolbar.appendChild(copyButton);
    toolbar.appendChild(clearButton);
    toolbar.appendChild(pauseButton);
    toolbar.appendChild(exportButton);

    this.container.appendChild(toolbar);
  }

  private createButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.padding = '4px 8px';
    button.style.border = '1px solid #ccc';
    button.style.borderRadius = '4px';
    button.style.backgroundColor = '#fff';
    button.style.cursor = 'pointer';
    button.style.flexShrink = '0'; // 防止按钮压缩
    button.addEventListener('click', onClick);
    return button;
  }

  private createLogContainer() {
    this.logContainer = document.createElement('div');
    this.logContainer.style.flex = '1'; // 占据剩余空间
    this.logContainer.style.overflowY = 'auto'; // 添加垂直滚动条
    this.logContainer.style.backgroundColor = this.backgroundColor;
    this.logContainer.style.color = this.textColor;
    this.logContainer.style.fontFamily = 'monospace';
    this.logContainer.style.whiteSpace = 'pre-wrap';
    this.logContainer.style.padding = '8px';
    this.logContainer.style.lineHeight = '1.4';
    
    this.logContainer.addEventListener('scroll', () => {
      const threshold = 50;
      const isNearBottom = 
        this.logContainer.scrollHeight - 
        this.logContainer.scrollTop - 
        this.logContainer.clientHeight <= threshold;
      
      this.autoScroll = isNearBottom;
    });

    this.container.appendChild(this.logContainer);
  }

  private setupEventListeners() {
    this.searchInput.addEventListener('input', () => {
      this.searchTerm = this.searchInput.value.trim();
      this.highlightMatches();
    });
    
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    });
  }

  private formatTimestamp(): string {
    const now = new Date();
    // const year = now.getFullYear().toString().slice(-2).padStart(2, '0');
    // const month = (now.getMonth() + 1).toString().padStart(2, '0');
    // const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
    
    // return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  private processLogText(text: string): string {
    return this.showTimestamp ? `[${this.formatTimestamp()}] ${text}` : text;
  }

  private highlightMatches() {
    if (!this.searchTerm) {
      this.lines.forEach((line, index) => {
        line.style.display = 'block';
        line.innerHTML = '';
        line.textContent = this.originalLines[index];
        line.style.color = line.dataset.originalColor || this.textColor;
      });
      return;
    }

    const regex = new RegExp(this.escapeRegExp(this.searchTerm), 'gi');
    
    this.lines.forEach((line, index) => {
      const originalText = this.originalLines[index];
      
      const isMatch = regex.test(originalText);
      
      if (this.filterLinesOnSearch && !isMatch) {
        line.style.display = 'none';
        return;
      }
      
      line.style.display = 'block';
      regex.lastIndex = 0;
      
      const parts: string[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      
      while ((match = regex.exec(originalText)) !== null) {
        if (match.index > lastIndex) {
          parts.push(originalText.substring(lastIndex, match.index));
        }
        
        parts.push(`<span style="background-color: ${this.highlightColor}">${match[0]}</span>`);
        lastIndex = match.index + match[0].length;
      }
      
      if (lastIndex < originalText.length) {
        parts.push(originalText.substring(lastIndex));
      }
      
      line.innerHTML = parts.join('');
    });
  }

  private escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private shouldAutoScroll(): boolean {
    return this.autoScroll && !this.paused;
  }

  appendLog(text: string, color?: string) {
    this.appendLogs([{ text, color }]);
  }

  appendLogs(logs: LogEntry[]) {
    if (logs.length === 0) return;

    const fragment = document.createDocumentFragment();
    const newLines: HTMLDivElement[] = [];
    const newOriginalTexts: string[] = [];

    logs.forEach(log => {
      const processedText = this.processLogText(log.text);
      
      const line = document.createElement('div');
      line.textContent = processedText;
      line.style.color = log.color || this.textColor;
      line.dataset.originalColor = log.color || this.textColor;
      
      newLines.push(line);
      newOriginalTexts.push(processedText);
      fragment.appendChild(line);
    });

    this.logContainer.appendChild(fragment);
    this.lines.push(...newLines);
    this.originalLines.push(...newOriginalTexts);

    const excess = this.lines.length - this.maxLines;
    if (excess > 0) {
      const toRemoveLines = this.lines.splice(0, excess);
      this.originalLines.splice(0, excess);
      
      toRemoveLines.forEach(line => {
        if (line.parentNode === this.logContainer) {
          this.logContainer.removeChild(line);
        }
      });
    }

    if (this.searchTerm) {
      this.highlightMatches();
    }

    if (this.shouldAutoScroll()) {
      this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }
  }

  clearLogs() {
    while (this.logContainer.firstChild) {
      this.logContainer.removeChild(this.logContainer.firstChild);
    }
    this.lines = [];
    this.originalLines = [];
  }

  debug(text: string) {
    this.appendLog(text, this.debugColor);
  }

  info(text: string) {
    this.appendLog(text, this.infoColor);
  }

  error(text: string) {
    this.appendLog(text, this.errorColor);
  }

  private copyAll() {
    const text = this.originalLines.join('\n');
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Failed to copy logs:', err);
    });
  }

  private togglePause() {
    this.paused = !this.paused;
    const buttons = this.container.querySelectorAll('button');
    if (buttons.length >= 3) {
      buttons[2].textContent = this.paused ? 'Resume Scroll' : 'Pause Scroll';
    }
  }

  private exportFile() {
    const text = this.originalLines.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // 公开方法：更新高度
  setHeight(height: string) {
    this.height = height;
    this.container.style.height = height;
  }
}
