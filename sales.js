// مدیریت فروشها و گزارشگیری
class SalesManager {
    constructor(app) {
        this.app = app;
        this.setupSalesEventListeners();
    }

    setupSalesEventListeners() {
        // دکمههای فروش
        document.getElementById('markAsSold').addEventListener('click', () => this.markProductsAsSold());
        
        // دکمههای پرینت
        document.getElementById('printSales').addEventListener('click', () => this.printSales());
        document.getElementById('printInventory').addEventListener('click', () => this.printInventory());
        document.getElementById('printCategories').addEventListener('click', () => this.printCategories());
        
        // دکمههای مدیریت داده
        document.getElementById('backupData').addEventListener('click', () => this.backupData());
        document.getElementById('restoreData').addEventListener('click', () => this.triggerRestore());
        document.getElementById('clearData').addEventListener('click', () => this.clearData());
        document.getElementById('restoreFile').addEventListener('change', (e) => this.restoreData(e));
        
        // تنظیمات تلگرام
        document.getElementById('saveTelegramSettings').addEventListener('click', () => this.saveTelegramSettings());
    }

    async renderUserSoldItems() {
        if (!this.app.currentStore) return;
        
        const soldItemsList = document.getElementById('soldItemsList');
        if (!soldItemsList) return;
        
        soldItemsList.innerHTML = '';
        
        try {
            // فقط فروشهای امروز
            const today = new Date().toISOString().split('T')[0];
            const { data: sales, error } = await this.app.supabase
                .from('sales')
                .select(`
                    *,
                    categories(name)
                `)
                .eq('store_id', this.app.currentStore.id)
                .gte('sold_at', `${today}T00:00:00`)
                .lte('sold_at', `${today}T23:59:59`)
                .order('sold_at', { ascending: false });
            
            if (error) throw error;
            
            if (!sales || sales.length === 0) {
                soldItemsList.innerHTML = '<p style="text-align: center; color: var(--text-light);">هیچ فروشی برای امروز ثبت نشده است</p>';
                return;
            }
            
            sales.forEach((sale, index) => {
                const soldItem = document.createElement('div');
                soldItem.className = 'sold-item';
                soldItem.innerHTML = `
                    <div class="sold-item-info">
                        <div class="sold-item-name">${sale.product_name}</div>
                        <div class="sold-item-details">
                            قیمت: ${sale.price.toLocaleString('fa-IR')} افغانی | 
                            دسته بندی: ${sale.categories?.name || 'نامشخص'} |
                            زمان: ${new Date(sale.sold_at).toLocaleTimeString('fa-IR')}
                        </div>
                    </div>
                    <div class="sold-item-actions">
                        <button class="btn-warning" onclick="salesManager.returnProduct('${sale.id}', '${sale.product_id}')">بازگرداندن</button>
                    </div>
                `;
                soldItemsList.appendChild(soldItem);
            });
            
        } catch (error) {
            console.error('خطا در بارگذاری فروشها:', error);
            this.app.showNotification('خطا در بارگذاری فروشها', 'error');
        }
    }

    async updateProductsChecklist() {
        if (!this.app.currentStore) return;
        
        const checklist = document.getElementById('productsChecklist');
        if (!checklist) return;
        
        checklist.innerHTML = '';
        
        try {
            const { data: products, error } = await this.app.supabase
                .from('products')
                .select(`
                    *,
                    categories(name),
                    parent_product:products(name)
                `)
                .eq('store_id', this.app.currentStore.id)
                .eq('is_sold', false)
                .order('name');
            
            if (error) throw error;
            
            if (!products || products.length === 0) {
                checklist.innerHTML = '<p style="text-align: center; color: var(--text-light);">هیچ محصولی برای فروش موجود نیست</p>';
                return;
            }
            
            products.forEach(product => {
                const checkboxItem = document.createElement('div');
                checkboxItem.className = 'checkbox-item';
                checkboxItem.innerHTML = `
                    <input type="checkbox" id="product_${product.id}" value="${product.id}">
                    <label for="product_${product.id}">
                        ${product.name} - ${product.price.toLocaleString('fa-IR')} افغانی
                        ${product.parent ? ` (زیرمجموعه ${product.parent_product?.name || ''})` : ''}
                    </label>
                `;
                checklist.appendChild(checkboxItem);
            });
            
        } catch (error) {
            console.error('خطا در بارگذاری چکلیست محصولات:', error);
            this.app.showNotification('خطا در بارگذاری محصولات', 'error');
        }
    }

    async markProductsAsSold() {
        if (!this.app.currentStore) return;
        
        const checkboxes = document.querySelectorAll('#productsChecklist input[type="checkbox"]:checked');
        if (checkboxes.length === 0) {
            this.app.showNotification('هیچ محصولی انتخاب نشده است', 'warning');
            return;
        }
        
        const soldProducts = [];
        let totalAmount = 0;
        
        try {
            for (const checkbox of checkboxes) {
                const productId = checkbox.value;
                
                // دریافت اطلاعات محصول
                const { data: product, error: productError } = await this.app.supabase
                    .from('products')
                    .select('*')
                    .eq('id', productId)
                    .single();
                
                if (productError) throw productError;
                
                // ثبت فروش
                const { data: sale, error: saleError } = await this.app.supabase
                    .from('sales')
                    .insert([
                        {
                            store_id: this.app.currentStore.id,
                            product_id: productId,
                            product_name: product.name,
                            category_id: product.category_id,
                            price: product.price,
                            sold_at: new Date().toISOString()
                        }
                    ])
                    .select()
                    .single();
                
                if (saleError) throw saleError;
                
                // بهروزرسانی وضعیت محصول به فروخته شده
                const { error: updateError } = await this.app.supabase
                    .from('products')
                    .update({ is_sold: true })
                    .eq('id', productId);
                
                if (updateError) throw updateError;
                
                soldProducts.push(product);
                totalAmount += product.price;
            }
            
            this.app.showNotification(
                `${soldProducts.length} محصول با موفقیت به عنوان فروخته شده ثبت شد`,
                'success'
            );
            
            // رندر مجدد لیستها
            await this.renderUserSoldItems();
            await this.updateProductsChecklist();
            
            // بهروزرسانی آمار
            if (typeof window.updateUserStats === 'function') {
                window.updateUserStats();
            }
            
            // ارسال پیام تلگرام
            if (soldProducts.length === 1) {
                await this.sendToUserTelegram(
                    `💰 فروش جدید ثبت شد\n\n` +
                    `محصول: ${soldProducts[0].name}\n` +
                    `قیمت: ${soldProducts[0].price.toLocaleString('fa-IR')} افغانی\n` +
                    `تاریخ: ${new Date().toLocaleDateString('fa-IR')}`
                );
            } else {
                await this.sendToUserTelegram(
                    `💰 فروش چندگانه ثبت شد\n\n` +
                    `تعداد محصولات: ${soldProducts.length}\n` +
                    `جمع مبلغ: ${totalAmount.toLocaleString('fa-IR')} افغانی\n` +
                    `تاریخ: ${new Date().toLocaleDateString('fa-IR')}`
                );
            }
            
        } catch (error) {
            console.error('خطا در ثبت فروش:', error);
            this.app.showNotification('خطا در ثبت فروش', 'error');
        }
    }

    async returnProduct(saleId, productId) {
        if (!this.app.currentStore) return;
        
        if (!confirm('آیا از بازگرداندن این محصول اطمینان دارید؟')) return;
        
        try {
            // حذف از تاریخچه فروش
            const { error: saleError } = await this.app.supabase
                .from('sales')
                .delete()
                .eq('id', saleId);
            
            if (saleError) throw saleError;
            
            // بازگرداندن وضعیت محصول
            const { error: productError } = await this.app.supabase
                .from('products')
                .update({ is_sold: false })
                .eq('id', productId);
            
            if (productError) throw productError;
            
            this.app.showNotification('محصول با موفقیت بازگردانده شد', 'success');
            
            // رندر مجدد لیستها
            await this.renderUserSoldItems();
            await this.updateProductsChecklist();
            
            // بهروزرسانی آمار
            if (typeof window.updateUserStats === 'function') {
                window.updateUserStats();
            }
            
        } catch (error) {
            console.error('خطا در بازگرداندن محصول:', error);
            this.app.showNotification('خطا در بازگرداندن محصول', 'error');
        }
    }

    async updateUserStats() {
        if (!this.app.currentStore) return;
        
        try {
            // تعداد کل محصولات
            const { data: products, error: productsError } = await this.app.supabase
                .from('products')
                .select('id', { count: 'exact' })
                .eq('store_id', this.app.currentStore.id);
            
            if (productsError) throw productsError;
            
            // تعداد دستهبندیها
            const { data: categories, error: categoriesError } = await this.app.supabase
                .from('categories')
                .select('id', { count: 'exact' })
                .eq('store_id', this.app.currentStore.id);
            
            if (categoriesError) throw categoriesError;
            
            // تعداد محصولات اصلی
            const { data: parentProducts, error: parentError } = await this.app.supabase
                .from('products')
                .select('id', { count: 'exact' })
                .eq('store_id', this.app.currentStore.id)
                .is('parent', null);
            
            if (parentError) throw parentError;
            
            // تعداد فروشهای امروز
            const today = new Date().toISOString().split('T')[0];
            const { data: todaySales, error: salesError } = await this.app.supabase
                .from('sales')
                .select('id', { count: 'exact' })
                .eq('store_id', this.app.currentStore.id)
                .gte('sold_at', `${today}T00:00:00`)
                .lte('sold_at', `${today}T23:59:59`);
            
            if (salesError) throw salesError;
            
            // بهروزرسانی آمار در صفحه
            document.getElementById('totalProducts').textContent = products?.length || 0;
            document.getElementById('totalCategories').textContent = categories?.length || 0;
            document.getElementById('totalParents').textContent = parentProducts?.length || 0;
            document.getElementById('totalSold').textContent = todaySales?.length || 0;
            
        } catch (error) {
            console.error('خطا در بهروزرسانی آمار:', error);
        }
    }

    async sendToUserTelegram(message) {
        if (!this.app.currentStore || !this.app.currentStore.telegram_bot_token || !this.app.currentStore.telegram_chat_id) {
            this.updateTelegramStatus('تنظیمات تلگرام کاربر تعریف نشده است', 'error');
            return false;
        }
        
        try {
            const url = `https://api.telegram.org/bot${this.app.currentStore.telegram_bot_token}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: this.app.currentStore.telegram_chat_id,
                    text: message,
                    parse_mode: 'HTML'
                })
            });
            
            const result = await response.json();
            if (result.ok) {
                this.updateTelegramStatus('پیام ارسال شد', 'active');
                return true;
            } else {
                this.updateTelegramStatus('خطا در ارسال: ' + result.description, 'error');
                return false;
            }
        } catch (error) {
            console.error('خطا در ارسال به تلگرام:', error);
            this.updateTelegramStatus('خطا در اتصال به تلگرام', 'error');
            return false;
        }
    }

    updateTelegramStatus(message, type = '') {
        const statusElement = document.getElementById('telegramStatusText');
        const statusContainer = document.getElementById('telegramStatus');
        
        if (statusElement && statusContainer) {
            statusElement.textContent = message;
            statusContainer.className = 'telegram-status';
            if (type) {
                statusContainer.classList.add(type);
            }
            
            setTimeout(() => {
                statusElement.textContent = 'آماده';
                statusContainer.className = 'telegram-status';
            }, 5000);
        }
    }

    async saveTelegramSettings() {
        if (!this.app.currentStore) return;
        
        const token = document.getElementById('userTelegramToken').value;
        const chatId = document.getElementById('userTelegramChatId').value;
        
        try {
            const { error } = await this.app.supabase
                .from('stores')
                .update({
                    telegram_bot_token: token,
                    telegram_chat_id: chatId
                })
                .eq('id', this.app.currentStore.id);
            
            if (error) throw error;
            
            // بهروزرسانی وضعیت محلی
            this.app.currentStore.telegram_bot_token = token;
            this.app.currentStore.telegram_chat_id = chatId;
            
            this.app.saveToLocalStorage();
            this.app.showNotification('تنظیمات تلگرام ذخیره شد', 'success');
            
            // تست ارسال پیام
            if (token && chatId) {
                await this.sendToUserTelegram('✅ تنظیمات تلگرام با موفقیت ذخیره شد. این پیام تستی است.');
            }
            
        } catch (error) {
            console.error('خطا در ذخیره تنظیمات تلگرام:', error);
            this.app.showNotification('خطا در ذخیره تنظیمات تلگرام', 'error');
        }
    }

    backupData() {
        if (!this.app.currentStore) return;
        
        this.app.showNotification('این قابلیت به زودی اضافه خواهد شد', 'info');
    }

    triggerRestore() {
        document.getElementById('restoreFile').click();
    }

    async restoreData(e) {
        this.app.showNotification('این قابلیت به زودی اضافه خواهد شد', 'info');
        e.target.value = '';
    }

    async clearData() {
        if (!this.app.currentStore) return;
        
        if (!confirm('آیا از پاک کردن تمام داده های خود اطمینان دارید؟ این عمل غیرقابل برگشت است.')) return;
        
        try {
            // حذف تمام محصولات
            const { error: productsError } = await this.app.supabase
                .from('products')
                .delete()
                .eq('store_id', this.app.currentStore.id);
            
            if (productsError) throw productsError;
            
            // حذف تمام فروشها
            const { error: salesError } = await this.app.supabase
                .from('sales')
                .delete()
                .eq('store_id', this.app.currentStore.id);
            
            if (salesError) throw salesError;
            
            // بازنشانی تعداد محصولات در دستهبندیها
            const { error: categoriesError } = await this.app.supabase
                .from('categories')
                .update({ product_count: 0 })
                .eq('store_id', this.app.currentStore.id);
            
            if (categoriesError) throw categoriesError;
            
            this.app.showNotification('تمامی داده ها پاک شدند', 'success');
            
            // رندر مجدد همه چیز
            if (window.productsManager) {
                await window.productsManager.renderUserProducts();
            }
            await this.renderUserSoldItems();
            await this.updateProductsChecklist();
            await this.updateUserStats();
            
            await this.sendToUserTelegram(
                `🔄 داده ها بازنشانی شدند\n\n` +
                `تمامی محصولات و تاریخچه فروش پاک شدند.\n` +
                `تاریخ: ${new Date().toLocaleDateString('fa-IR')}`
            );
            
        } catch (error) {
            console.error('خطا در پاک کردن دادهها:', error);
            this.app.showNotification('خطا در پاک کردن دادهها', 'error');
        }
    }

    printSales() {
        if (!this.app.currentStore) return;
        this.app.showNotification('این قابلیت به زودی اضافه خواهد شد', 'info');
    }

    printInventory() {
        if (!this.app.currentStore) return;
        this.app.showNotification('این قابلیت به زودی اضافه خواهد شد', 'info');
    }

    printCategories() {
        if (!this.app.currentStore) return;
        this.app.showNotification('این قابلیت به زودی اضافه خواهد شد', 'info');
    }
}

// ایجاد نمونه از مدیر فروش
let salesManager;

// اضافه کردن توابع به window برای دسترسی جهانی
window.updateUserStats = async function() {
    if (salesManager) {
        await salesManager.updateUserStats();
    }
};

window.updateProductsChecklist = async function() {
    if (salesManager) {
        await salesManager.updateProductsChecklist();
    }
};

// مقداردهی اولیه مدیر فروش
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (window.App) {
            salesManager = new SalesManager(window.App);
            window.salesManager = salesManager;
        }
    }, 100);
});