// مدیریت محصولات
class ProductsManager {
    constructor(app) {
        this.app = app;
        this.setupProductsEventListeners();
    }

    setupProductsEventListeners() {
        // فرم محصولات
        document.getElementById('productForm').addEventListener('submit', (e) => this.handleAddProduct(e));
        document.getElementById('editProductForm').addEventListener('submit', (e) => this.handleEditProduct(e));
        
        // دکمه خروجی
        document.getElementById('exportProducts').addEventListener('click', () => this.exportProducts());
    }

    async renderUserProducts() {
        if (!this.app.currentStore) return;
        
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        try {
            const { data: products, error } = await this.app.supabase
                .from('products')
                .select(`
                    *,
                    categories(name),
                    parent_product:products(name)
                `)
                .eq('store_id', this.app.currentStore.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            if (!products || products.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: var(--text-light);">
                            هیچ محصولی ثبت نشده است
                        </td>
                    </tr>
                `;
                return;
            }
            
            const parentProducts = products.filter(p => p.parent === null);
            
            parentProducts.forEach(product => {
                const parentRow = document.createElement('tr');
                parentRow.className = 'parent-item';
                parentRow.innerHTML = `
                    <td>
                        <button class="toggle-children" data-id="${product.id}">+</button>
                        ${product.name}
                    </td>
                    <td>${product.categories?.name || 'نامشخص'}</td>
                    <td>${product.price.toLocaleString('fa-IR')}</td>
                    <td>-</td>
                    <td>${product.is_sold ? '<span style="color:red">فروخته شده</span>' : '<span style="color:green">موجود</span>'}</td>
                    <td class="actions">
                        <button class="btn-success" onclick="productsManager.openEditProductModal('${product.id}')">ویرایش</button>
                        <button class="btn-danger" onclick="productsManager.deleteProduct('${product.id}')">حذف</button>
                    </td>
                `;
                tbody.appendChild(parentRow);
                
                const childProducts = products.filter(p => p.parent === product.id);
                childProducts.forEach(child => {
                    const childRow = document.createElement('tr');
                    childRow.className = 'child-item hidden';
                    childRow.setAttribute('data-parent', product.id);
                    childRow.innerHTML = `
                        <td>→ ${child.name}</td>
                        <td>${child.categories?.name || 'نامشخص'}</td>
                        <td>${child.price.toLocaleString('fa-IR')}</td>
                        <td>${product.name}</td>
                        <td>${child.is_sold ? '<span style="color:red">فروخته شده</span>' : '<span style="color:green">موجود</span>'}</td>
                        <td class="actions">
                            <button class="btn-success" onclick="productsManager.openEditProductModal('${child.id}')">ویرایش</button>
                            <button class="btn-danger" onclick="productsManager.deleteProduct('${child.id}')">حذف</button>
                        </td>
                    `;
                    tbody.appendChild(childRow);
                });
            });
            
            // اضافه کردن event listener برای دکمههای toggle
            document.querySelectorAll('.toggle-children').forEach(button => {
                button.addEventListener('click', function() {
                    const parentId = this.getAttribute('data-id');
                    const childRows = document.querySelectorAll(`tr[data-parent="${parentId}"]`);
                    const isHidden = childRows.length > 0 && childRows[0].classList.contains('hidden');
                    
                    childRows.forEach(row => {
                        if (isHidden) {
                            row.classList.remove('hidden');
                        } else {
                            row.classList.add('hidden');
                        }
                    });
                    
                    this.textContent = isHidden ? '-' : '+';
                });
            });
            
        } catch (error) {
            console.error('خطا در بارگذاری محصولات:', error);
            this.app.showNotification('خطا در بارگذاری محصولات', 'error');
        }
    }

    async populateProductDropdowns() {
        if (!this.app.currentStore) return;
        
        try {
            // بارگذاری دستهبندیها
            const { data: categories, error: catError } = await this.app.supabase
                .from('categories')
                .select('*')
                .eq('store_id', this.app.currentStore.id)
                .order('name');
            
            if (catError) throw catError;
            
            const categorySelects = [
                document.getElementById('productCategory'),
                document.getElementById('editProductCategory'),
                document.getElementById('categoryParent')
            ];
            
            categorySelects.forEach(select => {
                if (select) {
                    const currentValue = select.value;
                    select.innerHTML = '<option value="">انتخاب کنید</option>';
                    
                    categories
                        .filter(c => c.parent === null)
                        .forEach(category => {
                            const option = document.createElement('option');
                            option.value = category.id;
                            option.textContent = category.name;
                            select.appendChild(option);
                        });
                    
                    if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
                        select.value = currentValue;
                    }
                }
            });
            
            // بارگذاری محصولات اصلی برای dropdown والد
            const { data: parentProducts, error: prodError } = await this.app.supabase
                .from('products')
                .select('id, name')
                .eq('store_id', this.app.currentStore.id)
                .is('parent', null)
                .order('name');
            
            if (prodError) throw prodError;
            
            const parentSelects = [
                document.getElementById('productParent'),
                document.getElementById('editProductParent')
            ];
            
            parentSelects.forEach(select => {
                if (select) {
                    const currentValue = select.value;
                    select.innerHTML = '<option value="">هیچکدام (محصول اصلی)</option>';
                    
                    parentProducts.forEach(product => {
                        const option = document.createElement('option');
                        option.value = product.id;
                        option.textContent = product.name;
                        select.appendChild(option);
                    });
                    
                    if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
                        select.value = currentValue;
                    }
                }
            });
            
        } catch (error) {
            console.error('خطا در بارگذاری dropdownها:', error);
        }
    }

    async handleAddProduct(e) {
        e.preventDefault();
        if (!this.app.currentStore) return;
        
        const name = document.getElementById('productName').value;
        const category = document.getElementById('productCategory').value;
        const price = parseFloat(document.getElementById('productPrice').value);
        const parent = document.getElementById('productParent').value || null;
        const description = document.getElementById('productDescription').value;
        
        if (!name || !category || !price) {
            this.app.showNotification('لطفا تمام فیلدهای ضروری را پر کنید', 'error');
            return;
        }
        
        try {
            const { data, error } = await this.app.supabase
                .from('products')
                .insert([
                    {
                        store_id: this.app.currentStore.id,
                        name: name,
                        category_id: category,
                        price: price,
                        parent: parent,
                        description: description,
                        is_sold: false
                    }
                ])
                .select()
                .single();
            
            if (error) throw error;
            
            this.app.showNotification('محصول با موفقیت اضافه شد', 'success');
            document.getElementById('productForm').reset();
            
            // رندر مجدد لیست محصولات
            await this.renderUserProducts();
            
            // بهروزرسانی آمار
            if (typeof window.updateUserStats === 'function') {
                window.updateUserStats();
            }
            
            // بهروزرسانی چکلیست محصولات
            if (typeof window.updateProductsChecklist === 'function') {
                window.updateProductsChecklist();
            }
            
        } catch (error) {
            console.error('خطا در افزودن محصول:', error);
            this.app.showNotification('خطا در افزودن محصول', 'error');
        }
    }

    async openEditProductModal(productId) {
        if (!this.app.currentStore) return;
        
        try {
            const { data: product, error } = await this.app.supabase
                .from('products')
                .select(`
                    *,
                    categories(name)
                `)
                .eq('id', productId)
                .single();
            
            if (error) throw error;
            
            document.getElementById('editProductId').value = product.id;
            document.getElementById('editProductName').value = product.name;
            document.getElementById('editProductCategory').value = product.category_id;
            document.getElementById('editProductPrice').value = product.price;
            document.getElementById('editProductParent').value = product.parent || '';
            document.getElementById('editProductDescription').value = product.description || '';
            
            // مطمئن شویم dropdownها پر شدهاند
            await this.populateProductDropdowns();
            
            document.getElementById('editProductModal').style.display = 'flex';
            
        } catch (error) {
            console.error('خطا در بارگذاری محصول:', error);
            this.app.showNotification('خطا در بارگذاری محصول', 'error');
        }
    }

    async handleEditProduct(e) {
        e.preventDefault();
        if (!this.app.currentStore) return;
        
        const productId = document.getElementById('editProductId').value;
        const name = document.getElementById('editProductName').value;
        const category = document.getElementById('editProductCategory').value;
        const price = parseFloat(document.getElementById('editProductPrice').value);
        const parent = document.getElementById('editProductParent').value || null;
        const description = document.getElementById('editProductDescription').value;
        
        if (!name || !category || !price) {
            this.app.showNotification('لطفا تمام فیلدهای ضروری را پر کنید', 'error');
            return;
        }
        
        try {
            const { error } = await this.app.supabase
                .from('products')
                .update({
                    name: name,
                    category_id: category,
                    price: price,
                    parent: parent,
                    description: description,
                    updated_at: new Date().toISOString()
                })
                .eq('id', productId);
            
            if (error) throw error;
            
            this.app.showNotification('محصول با موفقیت ویرایش شد', 'success');
            this.app.closeAllModals();
            
            // رندر مجدد لیست محصولات
            await this.renderUserProducts();
            
            // بهروزرسانی آمار
            if (typeof window.updateUserStats === 'function') {
                window.updateUserStats();
            }
            
        } catch (error) {
            console.error('خطا در ویرایش محصول:', error);
            this.app.showNotification('خطا در ویرایش محصول', 'error');
        }
    }

    async deleteProduct(productId) {
        if (!this.app.currentStore) return;
        
        if (!confirm('آیا از حذف این محصول اطمینان دارید؟')) return;
        
        try {
            const { error } = await this.app.supabase
                .from('products')
                .delete()
                .eq('id', productId);
            
            if (error) throw error;
            
            this.app.showNotification('محصول با موفقیت حذف شد', 'success');
            
            // رندر مجدد لیست محصولات
            await this.renderUserProducts();
            
            // بهروزرسانی آمار
            if (typeof window.updateUserStats === 'function') {
                window.updateUserStats();
            }
            
        } catch (error) {
            console.error('خطا در حذف محصول:', error);
            this.app.showNotification('خطا در حذف محصول', 'error');
        }
    }

    exportProducts() {
        if (!this.app.currentStore) return;
        
        // این تابع نیاز به پیادهسازی دارد
        this.app.showNotification('این قابلیت به زودی اضافه خواهد شد', 'info');
    }
}

// ایجاد نمونه از مدیر محصولات
let productsManager;

// تابع برای رندر داشبورد کاربر
window.renderUserDashboard = async function() {
    if (!window.App.currentStore) return;
    
    // بهروزرسانی اطلاعات کاربر
    document.getElementById('userStoreName').textContent = window.App.currentStore.store_name;
    
    // نمایش وضعیت تأیید کاربر
    const userStatusElement = document.getElementById('userStatus');
    const pendingApprovalElement = document.getElementById('pendingApproval');
    const userDashboardContent = document.getElementById('userDashboardContent');
    
    if (window.App.currentStore.approved) {
        userStatusElement.innerHTML = '<span class="user-status status-approved">تأیید شده</span>';
        pendingApprovalElement.style.display = 'none';
        userDashboardContent.style.display = 'block';
        
        // بارگذاری محصولات
        if (productsManager) {
            await productsManager.renderUserProducts();
            await productsManager.populateProductDropdowns();
        }
        
        // بارگذاری اطلاعات پروفایل
        if (authManager) {
            authManager.loadProfileData();
        }
        
    } else {
        userStatusElement.innerHTML = '<span class="user-status status-pending">در انتظار تأیید</span>';
        pendingApprovalElement.style.display = 'block';
        userDashboardContent.style.display = 'none';
    }
};

// مقداردهی اولیه مدیر محصولات
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (window.App) {
            productsManager = new ProductsManager(window.App);
        }
    }, 100);
});