// فایل اصلی برنامه - مدیریت کلی سیستم
class StoreManagementSystem {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.isAdmin = false;
        this.currentStore = null;
        this.SYSTEM_CONFIG = {
            adminEmail: 'wwtn6191@gmail.com',
            adminPassword: 'admin123',
            telegramBotToken: '8207227177:AAEp7JifbIQUCWYscaOxokpvdvTxat7EbQ8',
            telegramChatId: '8106254967',
            version: '2.1.0'
        };
        
        this.init();
    }

    async init() {
        try {
            // ایجاد کلاینت Supabase
            this.supabase = supabase.createClient(
                'https://atichswkxinwqewtpvkr.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0aWNoc3dreGlud3Fld3RwdmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODA2NjAsImV4cCI6MjA3NzE1NjY2MH0.UmJ7mQt4bmwIpvlrnp7J1TigQ8JqB09w_0OgcIVCtFA'
            );

            // بررسی وضعیت احراز هویت
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session) {
                await this.handleExistingSession(session);
            } else {
                await this.checkLocalStorage();
            }

            this.setupEventListeners();
            this.showAppropriatePage();

        } catch (error) {
            console.error('خطا در مقداردهی اولیه سیستم:', error);
            this.showNotification('خطا در راهاندازی سیستم', 'error');
        }
    }

    async handleExistingSession(session) {
        const user = session.user;
        
        if (user.email === this.SYSTEM_CONFIG.adminEmail) {
            this.currentUser = user;
            this.isAdmin = true;
            this.showNotification('ورود مدیر موفقیتآمیز', 'success');
            return;
        }

        const { data: store, error } = await this.supabase
            .from('stores')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error) {
            console.error('خطا در بارگذاری اطلاعات فروشگاه:', error);
            this.showNotification('خطا در بارگذاری اطلاعات', 'error');
            return;
        }

        if (store) {
            this.currentUser = user;
            this.currentStore = store;
            this.isAdmin = false;
            this.showNotification('ورود موفقیتآمیز', 'success');
        }
    }

    async checkLocalStorage() {
        const savedUser = localStorage.getItem('currentUser');
        const savedStore = localStorage.getItem('currentStore');
        const savedIsAdmin = localStorage.getItem('isAdmin');
        
        if (savedUser && savedStore) {
            this.currentUser = JSON.parse(savedUser);
            this.currentStore = JSON.parse(savedStore);
            this.isAdmin = JSON.parse(savedIsAdmin);
        }
    }

    setupEventListeners() {
        // مدیریت تبهای ورود
        document.getElementById('userLoginTab').addEventListener('click', () => this.switchLoginTab('user'));
        document.getElementById('adminLoginTab').addEventListener('click', () => this.switchLoginTab('admin'));
        
        // فرمهای ورود
        document.getElementById('userLoginForm').addEventListener('submit', (e) => this.handleUserLogin(e));
        document.getElementById('adminLoginForm').addEventListener('submit', (e) => this.handleAdminLogin(e));
        
        // فرم ثبتنام
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
        
        // دکمههای ناوبری
        document.getElementById('showRegisterForm').addEventListener('click', () => this.showRegisterPage());
        document.getElementById('backToLogin').addEventListener('click', () => this.showLoginPage());
        document.getElementById('forgotPassword').addEventListener('click', () => this.showForgotPasswordPage());
        document.getElementById('backToLoginFromForgot').addEventListener('click', () => this.showLoginPage());
        
        // دکمههای خروج
        document.getElementById('userLogout').addEventListener('click', () => this.logout());
        document.getElementById('adminLogout').addEventListener('click', () => this.logout());
        
        // مدیریت مودالها
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });
        
        // مدیریت تبهای کاربر و ادمین
        document.querySelectorAll('#userDashboard .tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchUserTab(tabName);
            });
        });
        
        document.querySelectorAll('#adminDashboard .tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchAdminTab(tabName);
            });
        });
        
        // کلیک خارج از مودال برای بستن
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });
    }

    switchLoginTab(tab) {
        const userTab = document.getElementById('userLoginTab');
        const adminTab = document.getElementById('adminLoginTab');
        const userForm = document.getElementById('userLoginForm');
        const adminForm = document.getElementById('adminLoginForm');
        
        if (tab === 'user') {
            userTab.classList.add('active');
            adminTab.classList.remove('active');
            userForm.style.display = 'block';
            adminForm.style.display = 'none';
        } else {
            userTab.classList.remove('active');
            adminTab.classList.add('active');
            userForm.style.display = 'none';
            adminForm.style.display = 'block';
        }
    }

    showAppropriatePage() {
        const loginPage = document.getElementById('loginPage');
        const registerPage = document.getElementById('registerPage');
        const forgotPasswordPage = document.getElementById('forgotPasswordPage');
        const userDashboard = document.getElementById('userDashboard');
        const adminDashboard = document.getElementById('adminDashboard');
        const userInfo = document.getElementById('userInfo');
        const userLogout = document.getElementById('userLogout');
        const adminLogout = document.getElementById('adminLogout');
        
        // مخفی کردن تمام صفحات
        loginPage.classList.add('hidden');
        registerPage.classList.add('hidden');
        forgotPasswordPage.classList.add('hidden');
        userDashboard.classList.add('hidden');
        adminDashboard.classList.add('hidden');
        userInfo.style.display = 'none';
        
        if (this.currentUser) {
            userInfo.style.display = 'flex';
            document.getElementById('userName').textContent = this.isAdmin ? 
                'مدیر سیستم' : 
                (this.currentStore?.store_name || 'فروشگاه');
                
            document.getElementById('userAvatar').textContent = this.isAdmin ? 
                'م' : 
                (this.currentStore?.store_name?.charAt(0) || 'ف');
            
            if (this.isAdmin) {
                adminDashboard.classList.remove('hidden');
                userLogout.style.display = 'none';
                adminLogout.style.display = 'block';
                if (typeof window.renderAdminDashboard === 'function') {
                    window.renderAdminDashboard();
                }
            } else {
                userDashboard.classList.remove('hidden');
                userLogout.style.display = 'block';
                adminLogout.style.display = 'none';
                if (typeof window.renderUserDashboard === 'function') {
                    window.renderUserDashboard();
                }
            }
        } else {
            loginPage.classList.remove('hidden');
        }
    }

    showLoginPage() {
        document.getElementById('loginPage').classList.remove('hidden');
        document.getElementById('registerPage').classList.add('hidden');
        document.getElementById('forgotPasswordPage').classList.add('hidden');
    }

    showRegisterPage() {
        document.getElementById('loginPage').classList.add('hidden');
        document.getElementById('registerPage').classList.remove('hidden');
        document.getElementById('forgotPasswordPage').classList.add('hidden');
    }

    showForgotPasswordPage() {
        document.getElementById('loginPage').classList.add('hidden');
        document.getElementById('registerPage').classList.add('hidden');
        document.getElementById('forgotPasswordPage').classList.remove('hidden');
    }

    async handleUserLogin(e) {
        e.preventDefault();
        const email = document.getElementById('userEmail').value;
        const password = document.getElementById('userPassword').value;
        
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            const { data: store, error: storeError } = await this.supabase
                .from('stores')
                .select('*')
                .eq('user_id', data.user.id)
                .single();
                
            if (storeError) throw storeError;
            
            this.currentUser = data.user;
            this.currentStore = store;
            this.isAdmin = false;
            
            this.saveToLocalStorage();
            this.showAppropriatePage();
            this.showNotification('ورود موفقیتآمیز', 'success');
            
        } catch (error) {
            console.error('خطا در ورود:', error);
            this.showNotification('ایمیل یا رمز عبور اشتباه است', 'error');
        }
    }

    async handleAdminLogin(e) {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        
        if (email === this.SYSTEM_CONFIG.adminEmail && password === this.SYSTEM_CONFIG.adminPassword) {
            this.currentUser = { 
                id: 'admin',
                email: this.SYSTEM_CONFIG.adminEmail,
                user_metadata: { name: 'مدیر سیستم' }
            };
            this.isAdmin = true;
            this.saveToLocalStorage();
            this.showAppropriatePage();
            this.showNotification('ورود مدیر موفقیتآمیز', 'success');
        } else {
            this.showNotification('ایمیل یا رمز عبور مدیر اشتباه است', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const storeName = document.getElementById('storeName').value;
        const ownerName = document.getElementById('ownerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            this.showNotification('رمز عبور و تکرار آن مطابقت ندارند', 'error');
            return;
        }
        
        try {
            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        store_name: storeName,
                        owner_name: ownerName
                    }
                }
            });
            
            if (authError) throw authError;
            
            const { data: storeData, error: storeError } = await this.supabase
                .from('stores')
                .insert([
                    {
                        user_id: authData.user.id,
                        store_name: storeName,
                        owner_name: ownerName,
                        email: email,
                        approved: false,
                        telegram_bot_token: '',
                        telegram_chat_id: ''
                    }
                ])
                .select()
                .single();
                
            if (storeError) throw storeError;
            
            const defaultCategories = [
                { name: "الکترونیک", parent: null, store_id: storeData.id },
                { name: "مواد غذایی", parent: null, store_id: storeData.id },
                { name: "ادویه جات", parent: null, store_id: storeData.id },
                { name: "لوازم خانگی", parent: null, store_id: storeData.id },
                { name: "پوشاک", parent: null, store_id: storeData.id }
            ];
            
            await this.supabase
                .from('categories')
                .insert(defaultCategories);
            
            this.showNotification('ثبت نام موفقیتآمیز. منتظر تأیید مدیر باشید', 'success');
            this.showLoginPage();
            
            this.sendToAdminTelegram(
                `🏪 درخواست ثبت نام جدید\n\n` +
                `فروشگاه: ${storeName}\n` +
                `صاحب: ${ownerName}\n` +
                `ایمیل: ${email}\n` +
                `تاریخ: ${new Date().toLocaleDateString('fa-IR')}\n\n` +
                `لطفا به پنل مدیریت مراجعه کنید.`
            );
            
        } catch (error) {
            console.error('خطا در ثبت نام:', error);
            this.showNotification('خطا در ثبت نام. ممکن است ایمیل قبلاً ثبت شده باشد', 'error');
        }
    }

    async logout() {
        try {
            if (!this.isAdmin) {
                await this.supabase.auth.signOut();
            }
            
            this.currentUser = null;
            this.currentStore = null;
            this.isAdmin = false;
            
            localStorage.removeItem('currentUser');
            localStorage.removeItem('currentStore');
            localStorage.removeItem('isAdmin');
            
            this.showAppropriatePage();
            this.showNotification('خروج موفقیتآمیز', 'info');
        } catch (error) {
            console.error('خطا در خروج:', error);
            this.showNotification('خطا در خروج', 'error');
        }
    }

    saveToLocalStorage() {
        try {
            if (this.currentUser) {
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                localStorage.setItem('isAdmin', JSON.stringify(this.isAdmin));
            }
            if (this.currentStore) {
                localStorage.setItem('currentStore', JSON.stringify(this.currentStore));
            }
        } catch (error) {
            console.error('خطا در ذخیره localStorage:', error);
        }
    }

    showNotification(message, type = 'info') {
        document.querySelectorAll('.notification').forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="ti ti-${type === 'success' ? 'circle-check' : type === 'error' ? 'alert-circle' : type === 'warning' ? 'alert-triangle' : 'info-circle'}"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    switchUserTab(tabName) {
        document.querySelectorAll('.user-tab').forEach(tab => {
            tab.classList.add('hidden');
        });
        
        document.querySelectorAll('#userDashboard .tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const targetTab = document.getElementById(`user${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
        if (targetTab) {
            targetTab.classList.remove('hidden');
        }
        
        const activeTab = document.querySelector(`#userDashboard .tab[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }

    switchAdminTab(tabName) {
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.add('hidden');
        });
        
        document.querySelectorAll('#adminDashboard .tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const targetTab = document.getElementById(`admin${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
        if (targetTab) {
            targetTab.classList.remove('hidden');
        }
        
        const activeTab = document.querySelector(`#adminDashboard .tab[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }

    async sendToAdminTelegram(message) {
        try {
            const url = `https://api.telegram.org/bot${this.SYSTEM_CONFIG.telegramBotToken}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: this.SYSTEM_CONFIG.telegramChatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });
            
            const result = await response.json();
            return result.ok;
        } catch (error) {
            console.error('خطا در ارسال به تلگرام مدیر:', error);
            return false;
        }
    }
}

// ایجاد نمونه از سیستم
let App;

// تابع callback برای ورود گوگل
window.handleGoogleSignIn = async function(response) {
    console.log('پاسخ احراز هویت گوگل:', response);
    
    try {
        const { credential } = response;
        
        const { data, error } = await App.supabase.auth.signInWithIdToken({
            provider: 'google',
            token: credential
        });
        
        if (error) throw error;
        
        const { data: store, error: storeError } = await App.supabase
            .from('stores')
            .select('*')
            .eq('user_id', data.user.id)
            .single();
            
        if (storeError) {
            const userMetadata = data.user.user_metadata;
            const { data: newStore, error: createError } = await App.supabase
                .from('stores')
                .insert([
                    {
                        user_id: data.user.id,
                        store_name: userMetadata.full_name || 'فروشگاه جدید',
                        owner_name: userMetadata.full_name || 'کاربر',
                        email: data.user.email,
                        approved: false,
                        telegram_bot_token: '',
                        telegram_chat_id: '',
                        google_id: data.user.id
                    }
                ])
                .select()
                .single();
                
            if (createError) throw createError;
            
            App.currentStore = newStore;
        } else {
            App.currentStore = store;
        }
        
        App.currentUser = data.user;
        App.isAdmin = false;
        App.saveToLocalStorage();
        App.showAppropriatePage();
        
        if (App.currentStore.approved) {
            App.showNotification('ورود با گوگل موفقیتآمیز بود', 'success');
        } else {
            App.showNotification('حساب شما در انتظار تأیید مدیر است', 'warning');
        }
        
    } catch (error) {
        console.error('خطا در ورود با گوگل:', error);
        App.showNotification('خطا در ورود با گوگل', 'error');
    }
};

// مقداردهی اولیه هنگام لود صفحه
document.addEventListener('DOMContentLoaded', function() {
    App = new StoreManagementSystem();
});

// در دسترس قرار دادن App در سطح جهانی
window.App = App;
