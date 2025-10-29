// مدیریت دستهبندیها
class CategoriesManager {
    constructor(app) {
        this.app = app;
        this.setupCategoriesEventListeners();
    }

    setupCategoriesEventListeners() {
        // فرم دستهبندیها
        document.getElementById('categoryForm').addEventListener('submit', (e) => this.handleAddCategory(e));
    }

    async renderUserCategories() {
        if (!this.app.currentStore) return;
        
        const tbody = document.getElementById('categoriesTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        try {
            const { data: categories, error } = await this.app.supabase
                .from('categories')
                .select(`
                    *,
                    parent_category:categories(name)
                `)
                .eq('store_id', this.app.currentStore.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            if (!categories || categories.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; color: var(--text-light);">
                            هیچ دسته بندی ثبت نشده است
                        </td>
                    </tr>
                `;
                return;
            }
            
            const parentCategories = categories.filter(c => c.parent === null);
            
            parentCategories.forEach(category => {
                const parentRow = document.createElement('tr');
                parentRow.className = 'parent-item';
                parentRow.innerHTML = `
                    <td>
                        <button class="toggle-children" data-id="${category.id}">+</button>
                        ${category.name}
                    </td>
                    <td>-</td>
                    <td>${category.product_count || 0}</td>
                    <td class="actions">
                        <button class="btn-success" onclick="categoriesManager.editCategory('${category.id}')">ویرایش</button>
                        <button class="btn-danger" onclick="categoriesManager.deleteCategory('${category.id}')">حذف</button>
                    </td>
                `;
                tbody.appendChild(parentRow);
                
                const childCategories = categories.filter(c => c.parent === category.id);
                childCategories.forEach(child => {
                    const childRow = document.createElement('tr');
                    childRow.className = 'child-item hidden';
                    childRow.setAttribute('data-parent', category.id);
                    childRow.innerHTML = `
                        <td>→ ${child.name}</td>
                        <td>${category.name}</td>
                        <td>${child.product_count || 0}</td>
                        <td class="actions">
                            <button class="btn-success" onclick="categoriesManager.editCategory('${child.id}')">ویرایش</button>
                            <button class="btn-danger" onclick="categoriesManager.deleteCategory('${child.id}')">حذف</button>
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
            console.error('خطا در بارگذاری دستهبندیها:', error);
            this.app.showNotification('خطا در بارگذاری دستهبندیها', 'error');
        }
    }

    async populateCategoryParentDropdown() {
        if (!this.app.currentStore) return;
        
        try {
            const { data: categories, error } = await this.app.supabase
                .from('categories')
                .select('id, name')
                .eq('store_id', this.app.currentStore.id)
                .is('parent', null)
                .order('name');
            
            if (error) throw error;
            
            const categoryParentSelect = document.getElementById('categoryParent');
            if (categoryParentSelect) {
                const currentValue = categoryParentSelect.value;
                categoryParentSelect.innerHTML = '<option value="">هیچکدام (دستهبندی اصلی)</option>';
                
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    categoryParentSelect.appendChild(option);
                });
                
                if (currentValue && Array.from(categoryParentSelect.options).some(opt => opt.value === currentValue)) {
                    categoryParentSelect.value = currentValue;
                }
            }
            
        } catch (error) {
            console.error('خطا در بارگذاری dropdown دستهبندیها:', error);
        }
    }

    async handleAddCategory(e) {
        e.preventDefault();
        if (!this.app.currentStore) return;
        
        const name = document.getElementById('categoryName').value;
        const parent = document.getElementById('categoryParent').value || null;
        
        if (!name) {
            this.app.showNotification('لطفا نام دستهبندی را وارد کنید', 'error');
            return;
        }
        
        try {
            const { data, error } = await this.app.supabase
                .from('categories')
                .insert([
                    {
                        store_id: this.app.currentStore.id,
                        name: name,
                        parent: parent,
                        product_count: 0
                    }
                ])
                .select()
                .single();
            
            if (error) throw error;
            
            this.app.showNotification('دستهبندی با موفقیت اضافه شد', 'success');
            document.getElementById('categoryForm').reset();
            
            // رندر مجدد لیست دستهبندیها
            await this.renderUserCategories();
            
            // بهروزرسانی dropdownهای محصولات
            if (window.productsManager) {
                await window.productsManager.populateProductDropdowns();
            }
            
        } catch (error) {
            console.error('خطا در افزودن دستهبندی:', error);
            this.app.showNotification('خطا در افزودن دستهبندی', 'error');
        }
    }

    async editCategory(categoryId) {
        if (!this.app.currentStore) return;
        
        try {
            const { data: category, error } = await this.app.supabase
                .from('categories')
                .select('*')
                .eq('id', categoryId)
                .single();
            
            if (error) throw error;
            
            const newName = prompt('نام جدید دستهبندی را وارد کنید:', category.name);
            if (newName && newName.trim() !== '') {
                const { error: updateError } = await this.app.supabase
                    .from('categories')
                    .update({ name: newName.trim() })
                    .eq('id', categoryId);
                
                if (updateError) throw updateError;
                
                this.app.showNotification('دستهبندی با موفقیت ویرایش شد', 'success');
                
                // رندر مجدد لیست دستهبندیها
                await this.renderUserCategories();
                
                // بهروزرسانی dropdownهای محصولات
                if (window.productsManager) {
                    await window.productsManager.populateProductDropdowns();
                }
            }
            
        } catch (error) {
            console.error('خطا در ویرایش دستهبندی:', error);
            this.app.showNotification('خطا در ویرایش دستهبندی', 'error');
        }
    }

    async deleteCategory(categoryId) {
        if (!this.app.currentStore) return;
        
        if (!confirm('آیا از حذف این دستهبندی اطمینان دارید؟ محصولات مرتبط نیز حذف خواهند شد.')) return;
        
        try {
            // ابتدا محصولات مرتبط را حذف میکنیم
            const { error: productsError } = await this.app.supabase
                .from('products')
                .delete()
                .eq('category_id', categoryId);
            
            if (productsError) throw productsError;
            
            // سپس دستهبندیهای فرزند را حذف میکنیم
            const { error: childCategoriesError } = await this.app.supabase
                .from('categories')
                .delete()
                .eq('parent', categoryId);
            
            if (childCategoriesError) throw childCategoriesError;
            
            // در نهایت دستهبندی اصلی را حذف میکنیم
            const { error: categoryError } = await this.app.supabase
                .from('categories')
                .delete()
                .eq('id', categoryId);
            
            if (categoryError) throw categoryError;
            
            this.app.showNotification('دستهبندی با موفقیت حذف شد', 'success');
            
            // رندر مجدد لیست دستهبندیها
            await this.renderUserCategories();
            
            // بهروزرسانی dropdownهای محصولات
            if (window.productsManager) {
                await window.productsManager.populateProductDropdowns();
            }
            
            // بهروزرسانی آمار
            if (typeof window.updateUserStats === 'function') {
                window.updateUserStats();
            }
            
        } catch (error) {
            console.error('خطا در حذف دستهبندی:', error);
            this.app.showNotification('خطا در حذف دستهبندی', 'error');
        }
    }

    async getCategoryName(categoryId) {
        if (!categoryId) return 'نامشخص';
        
        try {
            const { data: category, error } = await this.app.supabase
                .from('categories')
                .select('name')
                .eq('id', categoryId)
                .single();
            
            if (error) return 'نامشخص';
            
            return category.name;
        } catch (error) {
            return 'نامشخص';
        }
    }
}

// ایجاد نمونه از مدیر دستهبندیها
let categoriesManager;

// مقداردهی اولیه مدیر دستهبندیها
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (window.App) {
            categoriesManager = new CategoriesManager(window.App);
            
            // اضافه کردن به window برای دسترسی جهانی
            window.categoriesManager = categoriesManager;
        }
    }, 100);
});
