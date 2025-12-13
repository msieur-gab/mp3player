/**
 * Toast - Reusable toast notification system
 * Usage: window.toast.show('Message', 'success')
 * Types: success, error, info, warning
 */
class ToastContainer extends HTMLElement {
    constructor() {
        super();
        this.toasts = [];
        this.toastIdCounter = 0;
    }

    connectedCallback() {
        this.className = 'toast-container';

        // Make globally accessible
        window.toast = {
            show: (message, type = 'info', duration = 3000) => this.show(message, type, duration),
            success: (message, duration) => this.show(message, 'success', duration),
            error: (message, duration) => this.show(message, 'error', duration),
            info: (message, duration) => this.show(message, 'info', duration),
            warning: (message, duration) => this.show(message, 'warning', duration)
        };
    }

    show(message, type = 'info', duration = 3000) {
        const id = this.toastIdCounter++;

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.dataset.id = id;

        // Icon based on type
        const icons = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'warning',
            info: 'info'
        };

        toast.innerHTML = `
            <i class="ph ph-${icons[type] || 'info'}"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close" aria-label="Close">
                <i class="ph ph-x"></i>
            </button>
        `;

        // Add to container
        this.appendChild(toast);
        this.toasts.push({ id, element: toast });

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
        });

        // Setup close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn?.addEventListener('click', () => this.remove(id));

        // Auto-dismiss after duration (if duration > 0)
        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
        }

        return id;
    }

    remove(id) {
        const toastObj = this.toasts.find(t => t.id === id);
        if (!toastObj) return;

        const { element } = toastObj;

        // Animate out
        element.classList.remove('toast-show');
        element.classList.add('toast-hide');

        // Remove from DOM after animation
        setTimeout(() => {
            element.remove();
            this.toasts = this.toasts.filter(t => t.id !== id);
        }, 300);
    }

    clear() {
        this.toasts.forEach(({ id }) => this.remove(id));
    }
}

customElements.define('toast-container', ToastContainer);
export default ToastContainer;
