// مدیریت پنل ادمین
class AdminManager {
    constructor(app) {
        this.app = app;
        this.setupAdminEventListeners();
    }

    setupAdminEventListeners() {
        // دکمههای مدیریت
        document.getElementById('createStoreAccount').addEventListener('click', () => this.openCreateStoreModal());
        document.getElementById('createStoreForm').addEventListener('submit', (e) => this.handleCreateStore(e));
        document.getElementById('backupAllData').addEventListener('click', () => this.backupAllData());
        document.getElementById('resetAllData').addEventListener('click', () => this.resetAllData());
        document.getElementById('viewAllData').addEventListener('click', () => this.viewAllData());
    }

    async renderAdminDashboard() {
        await this.updateAdminStats();
        await this.renderStoresList();
        await this.renderApprovalList();
        await this.renderUserCredentials();
    }

    async updateAdminStats() {
        if (!this.app.isAdmin) return;
        
        try {
            // تعداد کل فروشگاهها
            const { data: stores, error: storesError } = await this.app.supabase
                .from('stores')
                .select('id', { count: 'exact' });
            
            if (storesError) throw storesError;
            
            // تعداد کل محصولات
            const { data: products, error: productsError } = await this.app.supabase
                .from('products')
                .select('id', { count: 'exact' });
            
            if (productsError) throw productsError;
            
            // تعداد کل فروشها
            const { data: sales, error: salesError } = await this.app.supabase
                .from('sales')
                .select('id', { count: 'exact' });
            
            if (salesError) throw salesError;
            
            // تعداد فروشگاههای جدید (7 روز گذشته)
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            
            const { data: newStores, error: newStoresError } = await this.app.supabase
                .from('stores')
                .select('id', { count: 'exact' })
                .gte('created_at', oneWeekAgo.toISOString());
            
            if (newStoresError) throw newStoresError;
            
            // بهروزرسانی آمار در صفحه
            document.getElementById('adminTotalStores').textContent = stores?.length || 0;
            document.getElementById('adminTotalProducts').textContent = products?.length || 0;
            document.getElementById('adminTotalSales').textContent = sales?.length || 0;
            document.getElementById('adminNewStores').textContent = newStores?.length || 0;
            
        } catch (error) {
            console.error('خطا در بهروزرسانی آمار ادمین:', error);
        }
    }

    async renderStoresList() {
        if (!this.app.isAdmin) return;
        
        const storesList = document.getElementById('storesList');
        if (!storesList) return;
        
        storesList.innerHTML = '';
        
        try {
            const { data: stores, error } = await this.app.supabase
                .from('stores')
                .select(`
                    *,
                    products(count),
                    categories(count),
                    sales(count)
                `)
                .eq('approved', true)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            if (!stores || stores.length === 0) {
                storesList.innerHTML = '<p style="text-align: center; color: var(--text-light);">هیچ فروشگاهی ثبت نام نکرده است</p>';
                return;
            }
            
            stores.forEach(store => {
                const storeItem = document.createElement('div');
                storeItem.className = 'store-item';
                storeItem.innerHTML = `
                    <div class="store-info">
                        <div class="store-name">${store.store_name}</div>
                        <div class="store-email">${store.email} - ${store.owner_name}</div>
                        <div class="store-details">
                            محصولات: ${store.products[0]?.count || 0} | 
                            دسته بندی ها: ${store.categories[0]?.count || 0} | 
                            فروش: ${store.sales[0]?.count || 0}
                        </div>
                    </div>
                    <div class="store-actions">
                        <button class="btn-info" onclick="adminManager.viewStoreDetails('${store.id}')">مشاهده</button>
                        <button class="btn-warning" onclick="adminManager.editStore('${store.id}')">ویرایش</button>
                        <button class="btn-danger" onclick="adminManager.deleteStore('${store.id}')">حذف</button>
                    </div>
                `;
                storesList.appendChild(storeItem);
            });
            
        } catch (error) {
            console.error('خطا در بارگذاری فروشگاهها:', error);
            this.app.showNotification('خطا در بارگذاری فروشگاهها', 'error');
        }
    }

    async renderApprovalList() {
        if (!this.app.isAdmin) return;
        
        const approvalList = document.getElementById('approvalList');
        if (!approvalList) return;
        
        approvalList.innerHTML = '';
        
        try {
            const { data: pendingStores, error } = await this.app.supabase
                .from('stores')
                .select('*')
                .eq('approved', false)
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            
            if (!pendingStores || pendingStores.length === 0) {
                approvalList.innerHTML = '<p style="text-align: center; color: var(--text-light);">هیچ درخواست تأییدی در انتظار نیست</p>';
                return;
            }
            
            pendingStores.forEach(store => {
                const approvalItem = document.createElement('div');
                approvalItem.className = 'approval-item';
                approvalItem.innerHTML = `
                    <div class="approval-info">
                        <div class="store-name">${store.store_name}</div>
                        <div class="store-email">${store.email} - ${store.owner_name}</div>
                        <div class="store-details">
                            تاریخ ثبتنام: ${new Date(store.created_at).toLocaleDateString('fa-IR')} | 
                            نوع ورود: ${store.google_id ? 'گوگل' : 'ایمیل/رمز عبور'}
                        </div>
                    </div>
                    <div class="approval-actions">
                        <button class="btn-success" onclick="adminManager.approveStore('${store.id}')">تأیید</button>
                        <button class="btn-danger" onclick="adminManager.rejectStore('${store.id}')">رد</button>
                    </div>
                `;
                approvalList.appendChild(approvalItem);
            });
            
        } catch (error) {
            console.error('خطا در بارگذاری درخواستهای تأیید:', error);
            this.app.showNotification('خطا در بارگذاری درخواستها', 'error');
        }
    }

    async renderUserCredentials() {
        if (!this.app.isAdmin) return;
        
        const userCredentialsTable = document.getElementById('userCredentialsTable');
        if (!userCredentialsTable) return;
        
        userCredentialsTable.innerHTML = '';
        
        try {
            const { data: allStores, error } = await this.app.supabase
                .from('stores')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            if (!allStores || allStores.length === 0) {
                userCredentialsTable.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: var(--text-light);">
                            هیچ کاربری ثبت نام نکرده است
                        </td>
                    </tr>
                `;
                return;
            }
            
            allStores.forEach(store => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${store.store_name}</td>
                    <td>${store.owner_name}</td>
                    <td>${store.email}</td>
                    <td class="password-cell">${store.google_id ? '---' : '***'}</td>
                    <td>
                        ${store.approved ? 
                            '<span class="user-status status-approved">تأیید شده</span>' : 
                            '<span class="user-status status-pending">در انتظار تأیید</span>'
                        }
                    </td>
                    <td>${new Date(store.created_at).toLocaleDateString('fa-IR')}</td>
                    <td>${store.google_id ? 'گوگل' : 'ایمیل/رمز عبور'}</td>
                `;
                userCredentialsTable.appendChild(row);
            });
            
        } catch (error) {
            console.error('خطا در بارگذاری اطلاعات کاربران:', error);
            this.app.showNotification('خطا در بارگذاری اطلاعات کاربران', 'error');
        }
    }

    async approveStore(storeId) {
        if (!this.app.isAdmin) return;
        
        try {
            const { error } = await this.app.supabase
                .from('stores')
                .update({ approved: true })
                .eq('id', storeId);
            
            if (error) throw error;
            
            this.app.showNotification('فروشگاه با موفقیت تأیید شد', 'success');
            
            // رندر مجدد لیستها
            await this.renderApprovalList();
            await this.renderStoresList();
            await this.renderUserCredentials();
            await this.updateAdminStats();
            
            // ارسال پیام به مدیر
            await this.app.sendToAdminTelegram(
                `✅ کاربر تأیید شد\n\n` +
                `فروشگاه: ${storeId}\n` +
                `تاریخ: ${new Date().toLocaleDateString('fa-IR')}`
            );
            
        } catch (error) {
            console.error('خطا در تأیید فروشگاه:', error);
            this.app.showNotification('خطا در تأیید فروشگاه', 'error');
        }
    }

    async rejectStore(storeId) {
        if (!this.app.isAdmin) return;
        
        if (!confirm('آیا از رد این درخواست اطمینان دارید؟')) return;
        
        try {
            // ابتدا اطلاعات فروشگاه را برای لاگ دریافت میکنیم
            const { data: store, error: storeError } = await this.app.supabase
                .from('stores')
                .select('store_name, email')
                .eq('id', storeId)
                .single();
            
            if (storeError) throw storeError;
            
            // حذف فروشگاه
            const { error } = await this.app.supabase
                .from('stores')
                .delete()
                .eq('id', storeId);
            
            if (error) throw error;
            
            this.app.showNotification(`درخواست ${store.store_name} رد شد`, 'success');
            
            // رندر مجدد لیستها
            await this.renderApprovalList();
            await this.renderStoresList();
            await this.renderUserCredentials();
            await this.updateAdminStats();
            
        } catch (error) {
            console.error('خطا در رد فروشگاه:', error);
            this.app.showNotification('خطا در رد فروشگاه', 'error');
        }
    }

    viewStoreDetails(storeId) {
        // این تابع میتواند یک مودال با جزئیات کامل نمایش دهد
        this.app.showNotification('این قابلیت به زودی اضافه خواهد شد', 'info');
    }

    editStore(storeId) {
        // این تابع میتواند یک فرم ویرایش نمایش دهد
        this.app.showNotification('این قابلیت به زودی اضافه خواهد شد', 'info');
    }

    async deleteStore(storeId) {
        if (!this.app.isAdmin) return;
        
        // دریافت اطلاعات فروشگاه برای نمایش در confirm
        const { data: store, error: storeError } = await this.app.supabase
            .from('stores')
            .select('store_name')
            .eq('id', storeId)
            .single();
        
        if (storeError) {
            this.app.showNotification('خطا در دریافت اطلاعات فروشگاه', 'error');
            return;
        }
        
        if (!confirm(`آیا از حذف فروشگاه "${store.store_name}" اطمینان دارید؟ تمام داده های مربوط به این فروشگاه حذف خواهند شد.`)) return;
        
        try {
            const { error } = await this.app.supabase
                .from('stores')
                .delete()
                .eq('id', storeId);
            
            if (error) throw error;
            
            this.app.showNotification(`فروشگاه ${store.store_name} حذف شد`, 'success');
            
            // رندر مجدد لیستها
            await this.renderStoresList();
            await this.renderUserCredentials();
            await this.updateAdminStats();
            
        } catch (error) {
            console.error('خطا در حذف فروشگاه:', error);
            this.app.showNotification('خطا در حذف فروشگاه', 'error');
        }
    }

    openCreateStoreModal() {
        document.getElementById('createStoreModal').style.display = 'flex';
    }

    async handleCreateStore(e) {
        e.preventDefault();
        if (!this.app.isAdmin) return;
        
        const storeName = document.getElementById('newStoreName').value;
        const ownerName = document.getElementById('newOwnerName').value;
        const email = document.getElementById('newStoreEmail').value;
        const password = document.getElementById('newStorePassword').value;
        
        try {
            // ثبت نام کاربر در Supabase Auth
            const { data: authData, error: authError } = await this.app.supabase.auth.signUp({
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
            
            // ایجاد رکورد فروشگاه
            const { data: storeData, error: storeError } = await this.app.supabase
                .from('stores')
                .insert([
                    {
                        user_id: authData.user.id,
                        store_name: storeName,
                        owner_name: ownerName,
                        email: email,
                        approved: true,
                        telegram_bot_token: '',
                        telegram_chat_id: ''
                    }
                ])
                .select()
                .single();
                
            if (storeError) throw storeError;
            
            // ایجاد دستهبندیهای پیشفرض
            const defaultCategories = [
                { name: "الکترونیک", parent: null, store_id: storeData.id },
                { name: "مواد غذایی", parent: null, store_id: storeData.id },
                { name: "ادویه جات", parent: null, store_id: storeData.id },
                { name: "لوازم خانگی", parent: null, store_id: storeData.id },
                { name: "پوشاک", parent: null, store_id: storeData.id }
            ];
            
            await this.app.supabase
                .from('categories')
                .insert(defaultCategories);
            
            this.app.closeAllModals();
            this.app.showNotification(`حساب فروشگاه ${storeName} با موفقیت ایجاد شد`, 'success');
            
            // رندر مجدد لیستها
            await this.renderStoresList();
            await this.renderUserCredentials();
            await this.updateAdminStats();
            
            // ارسال پیام به مدیر
            await this.app.sendToAdminTelegram(
                `✅ حساب جدید ایجاد شد\n\n` +
                `فروشگاه: ${storeName}\n` +
                `صاحب: ${ownerName}\n` +
                `ایمیل: ${email}\n` +
                `تاریخ: ${new Date().toLocaleDateString('fa-IR')}`
            );
            
        } catch (error) {
            console.error('خطا در ایجاد فروشگاه:', error);
            this.app.showNotification('خطا در ایجاد فروشگاه', 'error');
        }
    }

    backupAllData() {
        this.app.showNotification('این قابلیت به زودی اضافه خواهد شد', 'info');
    }

    async resetAllData() {
        if (!this.app.isAdmin) return;
        
        if (!confirm('آیا از بازنشانی تمام داده های سیستم اطمینان دارید؟ این عمل تمام کاربران، محصولات و تاریخچه را پاک میکند و غیرقابل برگشت است.')) return;
        
        try {
            // حذف تمام دادهها از جداول
            const { error: salesError } = await this.app.supabase
                .from('sales')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            
            if (salesError) throw salesError;
            
            const { error: productsError } = await this.app.supabase
                .from('products')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            
            if (productsError) throw productsError;
            
            const { error: categoriesError } = await this.app.supabase
                .from('categories')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            
            if (categoriesError) throw categoriesError;
            
            const { error: storesError } = await this.app.supabase
                .from('stores')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            
            if (storesError) throw storesError;
            
            this.app.showNotification('تمامی داده های سیستم بازنشانی شدند', 'success');
            
            // رندر مجدد داشبورد
            await this.renderAdminDashboard();
            
        } catch (error) {
            console.error('خطا در بازنشانی دادهها:', error);
            this.app.showNotification('خطا در بازنشانی دادهها', 'error');
        }
    }

    viewAllData() {
        this.app.showNotification('این قابلیت به زودی اضافه خواهد شد', 'info');
    }
}

// ایجاد نمونه از مدیر ادمین
let adminManager;

// تابع برای رندر داشبورد ادمین
window.renderAdminDashboard = async function() {
    if (adminManager) {
        await adminManager.renderAdminDashboard();
    }
};

// مقداردهی اولیه مدیر ادمین
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (window.App && window.App.isAdmin) {
            adminManager = new AdminManager(window.App);
            window.adminManager = adminManager;
        }
    }, 100);
});