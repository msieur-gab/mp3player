/**
 * PermissionModal - Modal dialog for requesting folder access permission
 */
class PermissionModal extends HTMLElement {
    constructor() {
        super();
        this.isVisible = false;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.innerHTML = `
            <div class="permission-modal-overlay hidden">
                <div class="permission-modal">
                    <div class="permission-modal-icon">
                        <i class="ph ph-folder-open"></i>
                    </div>
                    <h2 class="permission-modal-title">Folder Access Required</h2>
                    <p class="permission-modal-message">
                        This app needs access to your music folder to play your tracks.
                        Tap the button below to grant access.
                    </p>
                    <button class="permission-modal-button">
                        <i class="ph ph-key"></i>
                        Grant Access
                    </button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const button = this.querySelector('.permission-modal-button');
        const overlay = this.querySelector('.permission-modal-overlay');

        button?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('grant-permission'));
        });

        // Close on overlay click (optional - uncomment if desired)
        // overlay?.addEventListener('click', (e) => {
        //     if (e.target === overlay) {
        //         this.hide();
        //     }
        // });
    }

    show() {
        const overlay = this.querySelector('.permission-modal-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            this.isVisible = true;
        }
    }

    hide() {
        const overlay = this.querySelector('.permission-modal-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            this.isVisible = false;
        }
    }
}

customElements.define('permission-modal', PermissionModal);
export default PermissionModal;
