// Main state
const state = {
    selectedElement: null,
    elements: [],
    cssCode: '',
    jsCode: '',
    isDarkMode: false,
    isDragging: false,
    isResizing: false,
    isSnapping: false,
    snapLines: [],
    isDraggingCanvas: false,
    lastMouseX: 0,
    lastMouseY: 0,
    history: [],
    historyIndex: -1,
    nextId: 1,
    snapEnabled: true,
    snapDistance: 10,
    resizeTarget: null,
    resizeType: null,
    resizeStartSize: { width: 0, height: 0 },
    resizeStartPos: { x: 0, y: 0 }
};

// DOM Elements
const canvas = document.getElementById('htmlEditor');
const preview = document.getElementById('preview');
const propertiesPanel = document.getElementById('propertiesPanel');
const toast = document.getElementById('toast');
const cssEditor = document.getElementById('cssEditor');
const jsEditor = document.getElementById('jsEditor');
const cssHighlight = document.getElementById('cssHighlight');
const jsHighlight = document.getElementById('jsHighlight');

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Save project
function saveProject() {
    try {
        const snapshot = {
            canvas: canvas.innerHTML,
            css: state.cssCode,
            js: state.jsCode
        };
        localStorage.setItem('htmlEditorProject', JSON.stringify(snapshot));
        updatePreview();
        showToast('Project saved successfully');
        document.querySelector('.autosave-indicator').textContent = `Last auto-saved: ${new Date().toLocaleTimeString()}`;
    } catch (error) {
        console.error('Error saving project:', error);
        showToast('Error saving project');
    }
}

// Load project
function loadProject() {
    try {
        const savedProject = localStorage.getItem('htmlEditorProject');
        if (savedProject) {
            const projectData = JSON.parse(savedProject);
            canvas.innerHTML = projectData.canvas;
            state.cssCode = projectData.css;
            state.jsCode = projectData.js;
            cssEditor.value = state.cssCode;
            jsEditor.value = state.jsCode;
            updateCodeHighlight(cssEditor, cssHighlight, 'css');
            updateCodeHighlight(jsEditor, jsHighlight, 'javascript');
            state.history = [];
            state.historyIndex = -1;
            addToHistory();
            document.querySelectorAll('.element').forEach(addResizeHandles);
            updatePreview();
            showToast('Project loaded successfully');
        } else {
            showToast('No saved project found');
        }
    } catch (error) {
        console.error('Error loading project:', error);
        showToast('Error loading project');
    }
}

// Update undo/redo buttons
function updateUndoRedoButtons() {
    document.getElementById('undoBtn').disabled = state.historyIndex < 1;
    document.getElementById('redoBtn').disabled = state.historyIndex >= state.history.length - 1;
    document.getElementById('deleteBtn').disabled = !state.selectedElement;
}

// Undo
function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex--;
    applyHistoryState(state.history[state.historyIndex]);
}

// Redo
function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex++;
    applyHistoryState(state.history[state.historyIndex]);
}

// Apply history state
function applyHistoryState(historyState) {
    try {
        canvas.innerHTML = historyState.canvas;
        state.cssCode = historyState.css;
        state.jsCode = historyState.js;
        cssEditor.value = state.cssCode;
        jsEditor.value = state.jsCode;
        updateCodeHighlight(cssEditor, cssHighlight, 'css');
        updateCodeHighlight(jsEditor, jsHighlight, 'javascript');
        deselectElement();
        document.querySelectorAll('.element').forEach(addResizeHandles);
        updatePreview();
        updateUndoRedoButtons();
    } catch (error) {
        console.error('Error applying history state:', error);
        showToast('Error applying history state');
    }
}

// Generate unique ID
function generateId() {
    return `element-${state.nextId++}`;
}

// Select element
function selectElement(element) {
    if (state.selectedElement) {
        const current = document.getElementById(state.selectedElement);
        if (current) {
            current.classList.remove('selected');
            current.querySelectorAll('.resize-handle').forEach(h => h.style.display = 'none');
        }
    }
    element.classList.add('selected');
    element.querySelectorAll('.resize-handle').forEach(h => h.style.display = 'block');
    state.selectedElement = element.id;
    updatePropertiesPanel();
    updateUndoRedoButtons();
}

// Deselect element
function deselectElement() {
    if (state.selectedElement) {
        const current = document.getElementById(state.selectedElement);
        if (current) {
            current.classList.remove('selected');
            current.querySelectorAll('.resize-handle').forEach(h => h.style.display = 'none');
        }
    }
    state.selectedElement = null;
    updatePropertiesPanel();
    updateUndoRedoButtons();
}

// Create new element
function createNewElement(type) {
    const id = generateId();
    let html = '';
    let styles = {
        left: '50px',
        top: '50px',
        position: 'absolute'
    };

    switch (type) {
        case 'div':
            html = '<div>Container</div>';
            styles.width = '100px';
            styles.height = '100px';
            styles.backgroundColor = '#f1f1f1';
            break;
        case 'text':
            html = '<p>Text Content</p>';
            styles.width = '150px';
            break;
        case 'button':
            html = '<button>Button</button>';
            styles.padding = '8px 15px';
            break;
        case 'image':
            html = '<img src="/placeholder-150x100.svg" alt="placeholder">';
            styles.width = '152px';
            styles.height = '102px';
            break;
        case 'input':
            html = '<input type="text" placeholder="Input field">';
            styles.width = '150px';
            break;
        case 'textarea':
            html = '<textarea placeholder="Text area"></textarea>';
            styles.width = '150px';
            styles.height = '80px';
            break;
        case 'select':
            html = '<select><option>Option 1</option><option>Option 2</option></select>';
            styles.width = '150px';
            break;
        case 'checkbox':
            html = '<label><input type="checkbox"> Checkbox</label>';
            break;
        case 'flexbox':
            html = '<div><div>Item 1</div><div>Item 2</div><div>Item 3</div></div>';
            styles.width = '300px';
            styles.height = '100px';
            styles.display = 'flex';
            styles.justifyContent = 'space-between';
            styles.backgroundColor = '#eef5ff';
            styles.padding = '10px';
            break;
        case 'grid':
            html = '<div><div>Item 1</div><div>Item 2</div><div>Item 3</div><div>Item 4</div></div>';
            styles.width = '200px';
            styles.height = '200px';
            styles.display = 'grid';
            styles.gridTemplateColumns = '1fr 1fr';
            styles.gridGap = '10px';
            styles.backgroundColor = '#f9f1ff';
            styles.padding = '10px';
            break;
        case 'card':
            html = '<div><h3>Card Title</h3><p>Card content goes here</p></div>';
            styles.width = '200px';
            styles.padding = '15px';
            styles.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
            styles.backgroundColor = 'white';
            styles.borderRadius = '4px';
            break;
    }

    const styleStr = Object.entries(styles)
        .map(([key, value]) => `${key}: ${value};`)
        .join(' ');

    const element = document.createElement('div');
    element.className = 'element';
    element.id = id;
    element.dataset.type = type;
    element.innerHTML = html;
    element.setAttribute('style', styleStr);
    element.setAttribute('data-x', parseInt(styles.left) || 0);
    element.setAttribute('data-y', parseInt(styles.top) || 0);

    canvas.appendChild(element);
    state.elements.push({ id, type, html, styles });
    addResizeHandles(element);
    selectElement(element);
    addToHistory();
    updatePreview();
    showToast(`${type} element added`);
}

// Add resize handles
function addResizeHandles(element) {
    const handlePositions = ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'];
    handlePositions.forEach(pos => {
        if (!element.querySelector(`.resize-handle.${pos}`)) {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.dataset.handle = pos;
            handle.style.display = element.classList.contains('selected') ? 'block' : 'none';
            element.appendChild(handle);
        }
    });
}

// Update properties panel
function updatePropertiesPanel() {
    const inputs = document.querySelectorAll('.property-input');
    inputs.forEach(input => input.value = '');

    if (!state.selectedElement) return;

    const element = document.getElementById(state.selectedElement);
    if (!element) return;

    const style = window.getComputedStyle(element);
    document.getElementById('propLeft').value = parseInt(style.left) || 0;
    document.getElementById('propTop').value = parseInt(style.top) || 0;
    document.getElementById('propWidth').value = parseInt(style.width) || 0;
    document.getElementById('propHeight').value = parseInt(style.height) || 0;
    document.getElementById('propBgColor').value = rgbToHex(style.backgroundColor);
    document.getElementById('propTextColor').value = rgbToHex(style.color);
    document.getElementById('propFontSize').value = parseInt(style.fontSize) || 16;
    document.getElementById('propBorder').value = style.border;
    document.getElementById('propText').value = element.textContent.trim();
    document.getElementById('propHTML').value = element.innerHTML.trim();
}

// Update selected element properties
function updateSelectedElementProperties(e) {
    if (!state.selectedElement) return;

    const element = document.getElementById(state.selectedElement);
    if (!element) return;

    const input = e.target;
    const left = document.getElementById('propLeft').value;
    const top = document.getElementById('propTop').value;
    const width = document.getElementById('propWidth').value;
    const height = document.getElementById('propHeight').value;

    if (left) {
        element.style.left = `${left}px`;
        element.setAttribute('data-x', left);
    }
    if (top) {
        element.style.top = `${top}px`;
        element.setAttribute('data-y', top);
    }
    if (width) element.style.width = `${width}px`;
    if (height) element.style.height = `${height}px`;

    const bgColor = document.getElementById('propBgColor').value;
    const textColor = document.getElementById('propTextColor').value;
    const fontSize = document.getElementById('propFontSize').value;
    const border = document.getElementById('propBorder').value;

    if (bgColor) element.style.backgroundColor = bgColor;
    if (textColor) element.style.color = textColor;
    if (fontSize) element.style.fontSize = `${fontSize}px`;
    if (border) element.style.border = border;

    const text = document.getElementById('propText').value;
    const html = document.getElementById('propHTML').value;

    if (input.id === 'propText' && text !== element.textContent.trim()) {
        element.textContent = text;
    } else if (input.id === 'propHTML' && html !== element.innerHTML.trim()) {
        element.innerHTML = html;
        addResizeHandles(element);
    }

    addToHistory();
    updatePreview();
}

// Toggle properties panel
function togglePropertiesPanel() {
    propertiesPanel.classList.toggle('open');
}

// Update preview
const updatePreview = debounce(() => {
    try {
        let htmlContent = canvas.innerHTML;
        htmlContent = htmlContent.replace(/<div class="resize-handle.*?>.*?<\/div>|<div class="snap-line.*?>.*?<\/div>/g, '');

        const fullHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Preview</title>
            <style>
              body { margin: 0; padding: 0; }
              ${state.cssCode}
            <\/style>
          <\/head>
          <body>
            ${htmlContent}
            ${state.jsCode ? `<script>${state.jsCode}<\/script>` : ''}
          <\/body>
          <\/html>`;

        const doc = preview.contentDocument || preview.contentWindow.document;
        doc.open();
        doc.write(fullHtml);
        doc.close();
    } catch (error) {
        console.error('Error updating preview:', error);
        showToast('Error updating preview');
    }
}, 100);

// Add to history
function addToHistory() {
    const snapshot = {
        canvas: canvas.innerHTML,
        css: state.cssCode,
        js: state.jsCode
    };

    if (state.history.length === 0 ||
        state.history[state.history.length - 1].canvas !== snapshot.canvas ||
        state.history[state.history.length - 1].css !== snapshot.css ||
        state.history[state.history.length - 1].js !== snapshot.js) {
        state.history = state.history.slice(0, state.historyIndex + 1);
        state.history.push(snapshot);
        state.historyIndex = state.history.length - 1;
        if (state.history.length > 50) {
            state.history.shift();
            state.historyIndex--;
        }
        updateUndoRedoButtons();
    }
}

// Delete selected element
function deleteSelectedElement() {
    if (!state.selectedElement) return;

    const element = document.getElementById(state.selectedElement);
    if (element) {
        element.remove();
        state.elements = state.elements.filter(el => el.id !== state.selectedElement);
        deselectElement();
        addToHistory();
        updatePreview();
        showToast('Element deleted');
    }
}

// Show toast
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Download file
function downloadFile(url, fileName) {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// Export project
function exportProject() {
    try {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Exported Project</title>
            <link rel="stylesheet" href="styles.css">
          <\/head>
          <body>
            ${canvas.innerHTML.replace(/<div class="resize-handle.*?>.*?<\/div>|<div class="snap-line.*?>.*?<\/div>/g, '')}
            <script src="script.js"><\/script>
          <\/body>
          <\/html>`;

        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        downloadFile(URL.createObjectURL(htmlBlob), 'index.html');

        if (state.cssCode.trim()) {
            const cssBlob = new Blob([state.cssCode], { type: 'text/css' });
            downloadFile(URL.createObjectURL(cssBlob), 'styles.css');
        }

        if (state.jsCode.trim()) {
            const jsBlob = new Blob([state.jsCode], { type: 'text/javascript' });
            downloadFile(URL.createObjectURL(jsBlob), 'script.js');
        }

        showToast('Project exported successfully');
    } catch (error) {
        console.error('Error exporting project:', error);
        showToast('Error exporting project');
    }
}

// RGB to HEX
function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent') return '#ffffff';
    if (rgb.startsWith('#')) return rgb;

    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
        const [r, g, b] = match.slice(1).map(n => parseInt(n, 10));
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    return '#ffffff';
}

// Snapping
function handleElementSnapping(element, x, y, currentWidth, currentHeight) {
    const result = { snapX: x, snapY: y };
    if (!state.snapEnabled) return result;

    const elements = document.querySelectorAll('.element');
    let snappedX = false;
    let snappedY = false;

    elements.forEach(el => {
        if (el === element) return;

        const elLeft = parseInt(el.style.left) || 0;
        const elTop = parseInt(el.style.top) || 0;
        const elWidth = parseInt(el.style.width) || 100;
        const elHeight = parseInt(el.style.height) || 100;

        if (Math.abs(x - elLeft) < state.snapDistance) {
            result.snapX = elLeft;
            snappedX = true;
            showSnapLine('vertical', elLeft);
        } else if (Math.abs((x + currentWidth) - (elLeft + elWidth)) < state.snapDistance) {
            result.snapX = elLeft + elWidth - currentWidth;
            snappedX = true;
            showSnapLine('vertical', elLeft + elWidth);
        }
        if (Math.abs(y - elTop) < state.snapDistance) {
            result.snapY = elTop;
            snappedY = true;
            showSnapLine('horizontal', elTop);
        } else if (Math.abs((y + currentHeight) - (elTop + elHeight)) < state.snapDistance) {
            result.snapY = elTop + elHeight - currentHeight;
            snappedY = true;
            showSnapLine('horizontal', elTop + elHeight);
        }
    });

    if (!snappedX) hideSnapLine('vertical');
    if (!snappedY) hideSnapLine('horizontal');

    return result;
}

// Show snap line
function showSnapLine(direction, position) {
    const snapLine = document.querySelector(`.snap-line.${direction}`);
    if (snapLine) {
        snapLine.style.display = 'block';
        if (direction === 'horizontal') {
            snapLine.style.top = `${position}px`;
        } else {
            snapLine.style.left = `${position}px`;
        }
    }
}

// Hide snap line
function hideSnapLine(direction) {
    const snapLine = document.querySelector(`.snap-line.${direction}`);
    if (snapLine) snapLine.style.display = 'none';
}

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-theme');
    state.isDarkMode = document.body.classList.contains('dark-theme');
    localStorage.setItem('htmleditor-dark-mode', state.isDarkMode);
    updateCodeHighlight(cssEditor, cssHighlight, 'css');
    updateCodeHighlight(jsEditor, jsHighlight, 'javascript');
    showToast(state.isDarkMode ? 'Dark mode activated' : 'Light mode activated');
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
            case 'z':
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
                break;
            case 'y':
                e.preventDefault();
                redo();
                break;
            case 's':
                e.preventDefault();
                saveProject();
                break;
            case 'e':
                e.preventDefault();
                exportProject();
                break;
            case 'd':
                e.preventDefault();
                document.getElementById('themeToggle').click();
                break;
            case 'p':
                e.preventDefault();
                togglePropertiesPanel();
                break;
        }
    } else if (e.key === 'Delete' && state.selectedElement) {
        e.preventDefault();
        deleteSelectedElement();
    } else if (e.key === '?' || e.key === '/') {
        e.preventDefault();
        toggleShortcutsPanel();
    } else if (state.selectedElement) {
        const element = document.getElementById(state.selectedElement);
        let moved = false;
        let resized = false;
        const step = 1;

        if (e.ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            moved = true;
            const currentTop = parseInt(element.style.top) || 0;
            const currentLeft = parseInt(element.style.left) || 0;

            switch (e.key) {
                case 'ArrowUp':
                    element.style.top = `${currentTop - step}px`;
                    element.setAttribute('data-y', currentTop - step);
                    break;
                case 'ArrowDown':
                    element.style.top = `${currentTop + step}px`;
                    element.setAttribute('data-y', currentTop + step);
                    break;
                case 'ArrowLeft':
                    element.style.left = `${currentLeft - step}px`;
                    element.setAttribute('data-x', currentLeft - step);
                    break;
                case 'ArrowRight':
                    element.style.left = `${currentLeft + step}px`;
                    element.setAttribute('data-x', currentLeft + step);
                    break;
            }
        } else if (e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            resized = true;
            const currentWidth = parseInt(element.style.width) || 100;
            const currentHeight = parseInt(element.style.height) || 100;

            switch (e.key) {
                case 'ArrowUp':
                    element.style.height = `${currentHeight - step}px`;
                    break;
                case 'ArrowDown':
                    element.style.height = `${currentHeight + step}px`;
                    break;
                case 'ArrowLeft':
                    element.style.width = `${currentWidth - step}px`;
                    break;
                case 'ArrowRight':
                    element.style.width = `${currentWidth + step}px`;
                    break;
            }
        }

        if (moved || resized) {
            updatePropertiesPanel();
            addToHistory();
            updatePreview();
        }
    }
}

// Toggle shortcuts panel
function toggleShortcutsPanel() {
    const panel = document.getElementById('keyboardShortcuts');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
}

// Code highlighting
function updateCodeHighlight(editor, highlightElement, language) {
    highlightElement.textContent = editor.value;
    hljs.highlightElement(highlightElement);
}

// Interact.js setup
function setupInteractJS() {
    const elements = document.querySelectorAll('.element:not([data-interact-initialized])');
    elements.forEach(element => {
        interact(element)
            .draggable({
                inertia: false,
                modifiers: [
                    interact.modifiers.restrictRect({
                        restriction: 'parent',
                        endOnly: true
                    }),
                    interact.modifiers.snap({
                        targets: [
                            { x: 0, y: 0 },
                            ...Array.from(document.querySelectorAll('.element'))
                                .filter(el => el !== element)
                                .flatMap(el => {
                                    const rect = el.getBoundingClientRect();
                                    const canvasRect = canvas.getBoundingClientRect();
                                    return [
                                        { x: rect.left - canvasRect.left },
                                        { x: rect.right - canvasRect.left },
                                        { y: rect.top - canvasRect.top },
                                        { y: rect.bottom - canvasRect.top }
                                    ];
                                })
                        ],
                        range: state.snapDistance
                    })
                ],
                listeners: {
                    start(e) {
                        selectElement(e.target);
                        state.isDragging = true;
                        hideSnapLine('horizontal');
                        hideSnapLine('vertical');
                        e.target.classList.add('dragging');
                    },
                    move(e) {
                        const target = e.target;
                        let x = (parseFloat(target.getAttribute('data-x')) || 0) + e.dx;
                        let y = (parseFloat(target.getAttribute('data-y')) || 0) + e.dy;

                        const { snapX, snapY } = handleElementSnapping(target, x, y, target.offsetWidth, target.offsetHeight);
                        x = snapX;
                        y = snapY;

                        target.style.left = `${x}px`;
                        target.style.top = `${y}px`;
                        target.setAttribute('data-x', x);
                        target.setAttribute('data-y', y);

                        updatePropertiesPanel();
                    },
                    end(e) {
                        state.isDragging = false;
                        e.target.classList.remove('dragging');
                        hideSnapLine('horizontal');
                        hideSnapLine('vertical');
                        addToHistory();
                        updatePreview();
                    }
                }
            })
            .resizable({
                edges: { left: true, right: true, bottom: true, top: true },
                modifiers: [
                    interact.modifiers.restrictSize({
                        min: { width: 20, height: 20 }
                    })
                ],
                listeners: {
                    move(e) {
                        const target = e.target;
                        target.style.width = `${e.rect.width}px`;
                        target.style.height = `${e.rect.height}px`;

                        const x = (parseFloat(target.getAttribute('data-x')) || 0) + e.deltaRect.left;
                        const y = (parseFloat(target.getAttribute('data-y')) || 0) + e.deltaRect.top;
                        target.style.left = `${x}px`;
                        target.style.top = `${y}px`;
                        target.setAttribute('data-x', x);
                        target.setAttribute('data-y', y);

                        updatePropertiesPanel();
                    },
                    end(e) {
                        addToHistory();
                        updatePreview();
                    }
                }
            });

        element.setAttribute('data-interact-initialized', 'true');
    });
}

// Initialize event listeners
function initializeEventListeners() {
    // Toolbar buttons
    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);
    document.getElementById('saveBtn').addEventListener('click', saveProject);
    document.getElementById('loadBtn').addEventListener('click', loadProject);
    document.getElementById('exportBtn').addEventListener('click', exportProject);
    document.getElementById('deleteBtn').addEventListener('click', deleteSelectedElement);
    document.getElementById('togglePropertiesBtn').addEventListener('click', togglePropertiesPanel);
    document.getElementById('themeToggle').addEventListener('change', toggleDarkMode);
    document.getElementById('showShortcutsBtn').addEventListener('click', toggleShortcutsPanel);
    document.getElementById('closeShortcuts').addEventListener('click', toggleShortcutsPanel);

    // Tab switching
    document.querySelectorAll('.editor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}Tab`).classList.add('active');
            document.querySelector('.editor-info').textContent = tab.dataset.tab.toUpperCase() + ' Editor';
        });
    });

    // Element creation
    document.querySelectorAll('.element-button').forEach(button => {
        button.addEventListener('click', () => createNewElement(button.dataset.element));
    });

    // Canvas events
    canvas.addEventListener('mousedown', e => {
        const target = e.target.closest('.element');
        if (target) {
            selectElement(target);
        } else {
            deselectElement();
        }
    });

    // Property inputs
    document.querySelectorAll('.property-input').forEach(input => {
        input.addEventListener('change', updateSelectedElementProperties);
    });

    // Code editors
    cssEditor.addEventListener('input', () => {
        state.cssCode = cssEditor.value;
        updateCodeHighlight(cssEditor, cssHighlight, 'css');
        addToHistory();
        updatePreview();
    });

    jsEditor.addEventListener('input', () => {
        state.jsCode = jsEditor.value;
        updateCodeHighlight(jsEditor, jsHighlight, 'javascript');
        addToHistory();
        updatePreview();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Prevent text selection during drag/resize
    document.addEventListener('selectstart', e => {
        if (state.isDragging || state.isResizing) e.preventDefault();
    });
}

// Main initialization
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    const savedTheme = localStorage.getItem('htmleditor-dark-mode');
    if (savedTheme === 'true' || window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-theme');
        state.isDarkMode = true;
        document.getElementById('themeToggle').checked = true;
    }

    // Initialize code highlighting
    updateCodeHighlight(cssEditor, cssHighlight, 'css');
    updateCodeHighlight(jsEditor, jsHighlight, 'javascript');

    // Initialize event listeners
    initializeEventListeners();

    // Initialize interact.js
    setupInteractJS();

    // Setup observer for new elements
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                setupInteractJS();
            }
        });
    });
    observer.observe(canvas, { childList: true, subtree: true });

    // Initialize history
    addToHistory();

    // Auto-save
    setInterval(() => {
        saveProject();
        showToast('Auto-saved project');
    }, 30000);

    // Initial preview
    updatePreview();
});
