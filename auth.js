
// مدیریت احراز هویت و پروفایل کاربر
class AuthManager {
    constructor(app) {
        this.app = app;
        this.setupAuthEventListeners();
    }

    setupAuthEventListeners() {
        // فرم پروفایل
        document.getElementById('profileForm').addEventListener('submit', (e) => this.handleProfileUpdate(e));
        
        // فرم بازیابی رمز عبور
        document.getElementById('forgotPasswordForm').addEventListener('submit', (e) => this.handleForgotPassword(e));
        
        // دکمه پروفایل
        document.getElementById('userProfile').addEventListener('click', () => this.app.switchUserTab('profile'));
    }

    async handleProfileUpdate(e) {
        e.preventDefault();
        if (!this.app.currentUser || !this.app.currentStore) return;
        
        const storeName = document.getElementById('profileStoreName').value;
        const ownerName = document.getElementById('profileOwnerName').value;
        const email = document.getElementById('profileEmail').value;
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        
        try {
            // بهروزرسانی اطلاعات فروشگاه
            const { error: storeError } = await this.app.supabase
                .from('stores')
                .update({
                    store_name: storeName,
                    owner_name: ownerName
                })
                .eq('id', this.app.currentStore.id);
                
            if (storeError) throw storeError;
            
            // بهروزرسانی اطلاعات کاربر در Auth
            if (email !== this.app.currentUser.email) {
                const { error: authError } = await this.app.supabase.auth.updateUser({
                    email: email
                });
                
                if (authError) throw authError;
            }
            
            // تغییر رمز عبور
            if (newPassword && currentPassword) {
                if (newPassword !== confirmNewPassword) {
                    this.app.showNotification('رمز عبور جدید و تکرار آن مطابقت ندارند', 'error');
                    return;
                }
                
                const { error: passwordError } = await this.app.supabase.auth.updateUser({
                    password: newPassword
                });
                
                if (passwordError) throw passwordError;
            }
            
            // بهروزرسانی وضعیت محلی
            this.app.currentStore.store_name = storeName;
            this.app.currentStore.owner_name = ownerName;
            this.app.currentUser.email = email;
            
            this.app.saveToLocalStorage();
            this.app.showNotification('پروفایل با موفقیت بهروزرسانی شد', 'success');
            
            if (typeof window.renderUserDashboard === 'function') {
                window.renderUserDashboard();
            }
            
            // پاک کردن فیلدهای رمز عبور
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmNewPassword').value = '';
            
        } catch (error) {
            console.error('خطا در بهروزرسانی پروفایل:', error);
            this.app.showNotification('خطا در بهروزرسانی پروفایل', 'error');
        }
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        const email = document.getElementById('recoveryEmail').value;
        
        try {
            const { error } = await this.app.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin
            });
            
            if (error) throw error;
            
            this.app.showNotification('لینک بازیابی رمز عبور به ایمیل شما ارسال شد', 'success');
            setTimeout(() => {
                this.app.showLoginPage();
            }, 3000);
        } catch (error) {
            console.error('خطا در بازیابی رمز عبور:', error);
            this.app.showNotification('خطا در ارسال لینک بازیابی', 'error');
        }
    }

    loadProfileData() {
        if (!this.app.currentStore) return;
        
        document.getElementById('profileStoreName').value = this.app.currentStore.store_name;
        document.getElementById('profileOwnerName').value = this.app.currentStore.owner_name;
        document.getElementById('profileEmail').value = this.app.currentUser.email;
    }
}

// مقداردهی اولیه مدیر احراز هویت
let authManager;

document.addEventListener('DOMContentLoaded', function() {
    // این بعد از بارگذاری App فراخوانی میشود
    setTimeout(() => {
        if (window.App) {
            authManager = new AuthManager(window.App);
        }
    }, 100);
});