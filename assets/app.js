$(document).ready(function () {
    // Configuration
    var baseUrl = 'https://tasty-ideas.de/wp-json/wc/v3';
    var wpBaseUrl = 'https://tasty-ideas.de/wp-json/wp/v2';
    var consumerKey = 'ck_16d3b7b2dc3e8de14b797aea3b14da06079b78fb';
    var consumerSecret = 'cs_af1e3fafa1ed1b90ba84ae48cdd83253f249aa2e';

    // Create authentication query parameters
    var authParams = {
        consumer_key: consumerKey,
        consumer_secret: consumerSecret
    };

    // Pagination variables
    var currentPage = 1;
    var perPage = 20;
    var totalProducts = 0;

    // Loading state management
    const loadingManager = {
        showGlobal: function(message = 'Loading...') {
            $('.loading-overlay .loading-text').text(message);
            $('.loading-overlay').css('display', 'flex');
        },
        hideGlobal: function() {
            $('.loading-overlay').hide();
        },
        showTableLoading: function() {
            $('.table-loading').addClass('is-loading');
        },
        hideTableLoading: function() {
            $('.table-loading').removeClass('is-loading');
        },
        showFormLoading: function(formSelector) {
            $(formSelector).closest('.form-loading').addClass('is-loading');
        },
        hideFormLoading: function(formSelector) {
            $(formSelector).closest('.form-loading').removeClass('is-loading');
        },
        setButtonLoading: function(button, isLoading) {
            const $button = $(button);
            if (isLoading) {
                $button.prop('disabled', true)
                    .data('original-text', $button.html())
                    .html('<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>Loading...');
            } else {
                $button.prop('disabled', false)
                    .html($button.data('original-text'));
            }
        }
    };

    // Function to load and display products
    function loadProducts(page = 1) {
        loadingManager.showTableLoading();
        
        $.ajax({
            url: baseUrl + '/products',
            method: 'GET',
            data: {
                ...authParams,
                per_page: perPage,
                page: page
            },
            success: function (products, textStatus, request) {
                displayProducts(products);
                updatePagination(page, request);
            },
            error: function (xhr, status, error) {
                console.error('Error fetching products:', error);
                if (xhr.status === 403) {
                    alert('Authentication failed. Please check your API credentials.');
                } else {
                    alert('Error fetching products. Please check the console for details.');
                }
            },
            complete: function() {
                loadingManager.hideTableLoading();
            }
        });
    }

    function updatePagination(page, request) {
        totalProducts = parseInt(request.getResponseHeader('X-WP-Total') || 0);
        var totalPages = parseInt(request.getResponseHeader('X-WP-TotalPages') || 0);
        
        var startItem = (page - 1) * perPage + 1;
        var endItem = Math.min(page * perPage, totalProducts);
        $('#currentPageInfo').text(startItem + '-' + endItem);
        $('#totalProducts').text(totalProducts);

        $('#prevPage').prop('disabled', page <= 1);
        $('#nextPage').prop('disabled', page >= totalPages);
        
        currentPage = page;
    }

    function displayProducts(products) {
        const tbody = $('#productsTable tbody');
        tbody.empty();

        products.forEach(product => {
            const imageUrl = product.images && product.images.length > 0 
                ? product.images[0].src 
                : 'https://via.placeholder.com/150?text=No+Image';
            
            // Find BF article number from meta_data
            const bfArticleNumber = product.meta_data.find(meta => meta.key === 'bf_artikelnummer')?.value || product.id;
            
            const row = $(`
                <tr>
                    <td><img src="${imageUrl}" alt="${product.name}" class="product-image"></td>
                    <td>${bfArticleNumber}</td>
                    <td>${product.name}</td>
                    <td>${product.type}</td>
                    <td>€${product.regular_price || 'N/A'}</td>
                    <td>${product.description ? product.description.replace(/<[^>]*>/g, '').substring(0, 100) + '...' : ''}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary edit-product" data-product-id="${product.id}" data-bf-number="${bfArticleNumber}">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                    </td>
                </tr>
            `);
            
            row.find('.edit-product').on('click', function() {
                const productId = $(this).data('product-id');
                loadProductForEdit(productId);
            });
            
            tbody.append(row);
        });

        // Function to download all products as CSV
        function downloadAllProductsAsCSV() {
            loadingManager.setButtonLoading('#downloadCsv', true);

            // Get all products (no pagination)
            $.ajax({
                url: baseUrl + '/products',
                method: 'GET',
                data: {
                    ...authParams,
                    per_page: 100  // Maximum allowed per page
                },
                success: function(products) {
                    // Prepare CSV data
                    const csvRows = [];
                    
                    // Add CSV header
                    const headers = ['BF Article Number', 'Name', 'Type', 'Regular Price (€)', 'Sale Price (€)', 'Stock Status', 
                                   'Stock Quantity', 'Gebinde', 'Unit', 'Unit Amount', 'Description'];
                    csvRows.push(headers.join(','));

                    // Add product data
                    products.forEach(product => {
                        const gebindeAttr = product.attributes.find(attr => attr.name === 'Gebinde');
                        const gebinde = gebindeAttr ? gebindeAttr.options[0] : '';
                        
                        // Find unit and unit amount from meta data
                        const unitMeta = product.meta_data.find(meta => meta.key === '_unit');
                        const unitAmountMeta = product.meta_data.find(meta => meta.key === '_unit_amount');
                        const bfArticleNumber = product.meta_data.find(meta => meta.key === 'bf_artikelnummer')?.value || product.id;
                        
                        const row = [
                            bfArticleNumber,
                            `"${product.name.replace(/"/g, '""')}"`,  // Escape quotes in name
                            product.type,
                            product.regular_price || '',
                            product.sale_price || '',
                            product.stock_status,
                            product.stock_quantity || '',
                            `"${gebinde.replace(/"/g, '""')}"`,
                            unitMeta ? unitMeta.value : '',
                            unitAmountMeta ? unitAmountMeta.value : '',
                            `"${product.description.replace(/<[^>]*>/g, '').replace(/"/g, '""').replace(/\n/g, ' ')}"` // Clean description
                        ];
                        
                        csvRows.push(row.join(','));
                    });

                    // Create and download CSV file
                    const csvContent = csvRows.join('\n');
                    // Add UTF-8 BOM
                    const BOM = '\uFEFF';
                    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    if (navigator.msSaveBlob) { // IE 10+
                        navigator.msSaveBlob(blob, 'products.csv');
                    } else {
                        link.href = URL.createObjectURL(blob);
                        link.setAttribute('download', 'products.csv');
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error downloading products:', error);
                    alert('Error downloading products. Please check the console for details.');
                },
                complete: function() {
                    loadingManager.setButtonLoading('#downloadCsv', false);
                }
            });
        }

        // Event handler for CSV download
        $('#downloadCsv').on('click', downloadAllProductsAsCSV);
    }

    function loadProductForEdit(productId) {
        if (!productId) {
            alert('Please enter a valid product ID');
            return;
        }

        loadingManager.showGlobal('Loading product details...');
        
        $.ajax({
            url: baseUrl + '/products/' + productId,
            method: 'GET',
            data: authParams,
            success: function (product) {
                populateUpdateForm(product);
                $('#updateProductForm').show();
                // Store BF article number for later use
                $('#updateProductForm').data('bf-number', product.meta_data.find(meta => meta.key === 'bf_artikelnummer')?.value || product.id);
                // Scroll to the form
                $('html, body').animate({
                    scrollTop: $('#updateProductForm').offset().top - 100
                }, 500);
            },
            error: function (xhr, status, error) {
                console.error('Error loading product:', error);
                alert('Error finding product. Please check the console for details.');
            },
            complete: function() {
                loadingManager.hideGlobal();
            }
        });
    }

    function populateUpdateForm(product) {
        // Store the original product data for comparison
        $('#updateProductForm').data('original-product', product);

        $('#updateProductId').val(product.id);
        $('#updateProductName').val(product.name);
        $('#updateProductSku').val(product.sku);
        $('#updateProductDescription').val(product.description.replace(/<[^>]*>/g, ''));
        $('#updateShortDescription').val(product.short_description.replace(/<[^>]*>/g, ''));
        $('#updateRegularPrice').val(product.regular_price);
        $('#updateSalePrice').val(product.sale_price);
        $('#updateStockStatus').val(product.stock_status);
        $('#updateStockQuantity').val(product.stock_quantity);
        $('#updateTaxStatus').prop('checked', product.tax_status === 'taxable');

        // Handle Gebinde attribute
        const gebindeAttr = product.attributes.find(attr => attr.name === 'Gebinde');
        if (gebindeAttr && gebindeAttr.options.length > 0) {
            $('#updateGebindeType').val(gebindeAttr.options[0]);
        }

        // Handle meta data
        product.meta_data.forEach(function (meta) {
            switch (meta.key) {
                case '_unit':
                    $('#updateUnit').val(meta.value);
                    break;
                case '_unit_amount':
                    $('#updateUnitAmount').val(meta.value);
                    break;
                case '_delivery_time':
                    $('#updateDeliveryTime').val(meta.value);
                    break;
            }
        });

        // Handle categories
        const categoryValues = product.categories.map(cat => cat.slug);
        $('#updateCategories').val(categoryValues);
    }

    // Event Handlers
    $('#searchProduct').on('click', function() {
        const searchValue = $('#searchProductId').val();
        if (searchValue) {
            loadingManager.setButtonLoading(this, true);
            
            // First try to find product by BF article number
            $.ajax({
                url: baseUrl + '/products',
                method: 'GET',
                data: {
                    ...authParams,
                    meta_key: 'bf_artikelnummer',
                    meta_value: searchValue
                },
                success: function(products) {
                    if (products && products.length > 0) {
                        loadProductForEdit(products[0].id);
                    } else {
                        // If not found by BF number, try by ID as fallback
                        loadProductForEdit(searchValue);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error searching product:', error);
                    alert('Error searching product. Please check the console for details.');
                },
                complete: function() {
                    loadingManager.setButtonLoading('#searchProduct', false);
                }
            });
        } else {
            alert('Please enter a product ID or BF article number');
        }
    });

    // Update the search input placeholder
    $('#searchProductId').attr('placeholder', 'Enter BF Article Number or Product ID');

    // Close update form
    $('#closeUpdateForm').on('click', function() {
        $('#updateProductForm').hide();
        // Clear the form
        $('#productUpdateForm')[0].reset();
        $('#updateProductId').val('');
    });

    $('#prevPage').on('click', function() {
        if (currentPage > 1) {
            loadProducts(currentPage - 1);
        }
    });

    $('#nextPage').on('click', function() {
        loadProducts(currentPage + 1);
    });

    // Product update form submission
    $('#productUpdateForm').on('submit', function(e) {
        e.preventDefault();
        const productId = $('#updateProductId').val();
        
        if (!productId) {
            alert('No product selected for update');
            return;
        }

        loadingManager.showFormLoading('#productUpdateForm');
        
        // Get the original product data
        const originalProduct = $('#updateProductForm').data('original-product');
        const formData = {};

        // Helper function to check if a field has changed
        function hasFieldChanged(currentValue, originalValue) {
            return currentValue !== '' && currentValue !== undefined && 
                   currentValue !== null && currentValue !== originalValue;
        }

        // Check basic fields
        const fields = {
            name: $('#updateProductName').val(),
            sku: $('#updateProductSku').val(),
            description: $('#updateProductDescription').val(),
            short_description: $('#updateShortDescription').val(),
            regular_price: $('#updateRegularPrice').val(),
            sale_price: $('#updateSalePrice').val(),
            stock_status: $('#updateStockStatus').val(),
            stock_quantity: $('#updateStockQuantity').val()
        };

        // Add only changed fields to formData
        Object.entries(fields).forEach(([key, value]) => {
            if (hasFieldChanged(value, originalProduct[key])) {
                formData[key] = value;
            }
        });

        // Check tax status
        const taxStatus = $('#updateTaxStatus').is(':checked') ? 'taxable' : 'none';
        if (taxStatus !== originalProduct.tax_status) {
            formData.tax_status = taxStatus;
        }

        // Check Gebinde attribute
        const gebindeType = $('#updateGebindeType').val();
        const originalGebinde = originalProduct.attributes.find(attr => attr.name === 'Gebinde');
        const originalGebindeValue = originalGebinde ? originalGebinde.options[0] : '';
        
        if (hasFieldChanged(gebindeType, originalGebindeValue)) {
            formData.attributes = [{
                name: 'Gebinde',
                options: [gebindeType],
                visible: true,
                variation: false
            }];
        }

        // Check meta fields
        const changedMeta = [];
        const metaFields = {
            '_unit': $('#updateUnit').val(),
            '_unit_amount': $('#updateUnitAmount').val(),
            '_delivery_time': $('#updateDeliveryTime').val()
        };

        Object.entries(metaFields).forEach(([key, value]) => {
            const originalMeta = originalProduct.meta_data.find(m => m.key === key);
            if (hasFieldChanged(value, originalMeta ? originalMeta.value : '')) {
                changedMeta.push({ key: key, value: value });
            }
        });

        if (changedMeta.length > 0) {
            formData.meta_data = changedMeta;
        }

        // Check if any fields were changed
        if (Object.keys(formData).length === 0) {
            alert('No changes detected');
            loadingManager.hideFormLoading('#productUpdateForm');
            return;
        }

        $.ajax({
            url: baseUrl + '/products/' + productId + '?' + $.param(authParams),
            method: 'PUT',
            data: JSON.stringify(formData),
            contentType: 'application/json',
            success: function(response) {
                alert('Product updated successfully!');
                $('#updateProductForm').hide();
                loadProducts(currentPage);
            },
            error: function(xhr, status, error) {
                console.error('Error updating product:', error);
                alert('Error updating product. Please check the console for details.');
            },
            complete: function() {
                loadingManager.hideFormLoading('#productUpdateForm');
            }
        });
    });

    // Handle file input change and show preview
    $('#productImage').on('change', function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        // Update file input label
        $(this).next('.custom-file-label').html(file.name);
        
        // Show image preview
        reader.onload = function(e) {
            $('#imagePreview img').attr('src', e.target.result);
            $('#imagePreview').show();
        };
        
        reader.readAsDataURL(file);
    });

    // Product create form submission
    $('#createProductForm').on('submit', function(e) {
        e.preventDefault();
        
        loadingManager.showFormLoading('#createProductForm');
        
        // Create product directly without image
        const formData = {
            name: $('#productName').val(),
            sku: $('#productSku').val(),
            description: $('#productDescription').val(),
            short_description: $('#shortDescription').val(),
            regular_price: $('#regularPrice').val(),
            sale_price: $('#salePrice').val(),
            stock_status: $('#stockStatus').val(),
            stock_quantity: $('#stockQuantity').val(),
            tax_status: $('#taxStatus').is(':checked') ? 'taxable' : 'none',
            status: 'publish',
            type: 'simple',
            attributes: [{
                name: 'Gebinde',
                options: [$('#gebindeType').val()],
                visible: true,
                variation: false
            }],
            meta_data: [
                {
                    key: '_unit',
                    value: $('#unit').val()
                },
                {
                    key: '_unit_amount',
                    value: $('#unitAmount').val()
                },
                {
                    key: '_delivery_time',
                    value: $('#deliveryTime').val()
                }
            ],
            categories: $('#categories').val().map(category => ({
                id: 0,
                name: category
            }))
        };

        $.ajax({
            url: baseUrl + '/products?' + $.param(authParams),
            method: 'POST',
            data: JSON.stringify(formData),
            contentType: 'application/json',
            success: function(response) {
                alert('Product created successfully!');
                // Clear the form
                $('#createProductForm')[0].reset();
                // Switch to list tab and refresh products
                $('#apiTabs a[href="#list"]').tab('show');
                loadProducts(1);
            },
            error: function(xhr, status, error) {
                console.error('Error creating product:', error);
                alert('Error creating product. Please check the console for details.');
            },
            complete: function() {
                loadingManager.hideFormLoading('#createProductForm');
            }
        });
    });

    // Add event listeners for save buttons
    $('.save-button').on('click', function() {
        const button = $(this);
        const input = button.siblings('.price-input');
        const productId = input.data('product-id');
        const newPrice = input.val();

        // Disable input and button while saving
        button.prop('disabled', true);
        input.prop('disabled', true);

        $.ajax({
            url: baseUrl + '/products/' + productId + '?' + $.param(authParams),
            method: 'PUT',
            data: JSON.stringify({
                regular_price: newPrice
            }),
            contentType: 'application/json',
            success: function(response) {
                // Update the original price and reset the UI
                input.data('original-price', newPrice);
                input.removeClass('price-changed');
                button.hide();
                alert('Price updated successfully!');
            },
            error: function(xhr, status, error) {
                console.error('Error updating price:', error);
                if (xhr.status === 403) {
                    alert('Authentication failed. Please check your API credentials.');
                } else {
                    alert('Error updating price. Please check the console for details.');
                }
            },
            complete: function() {
                // Re-enable input and button
                button.prop('disabled', false);
                input.prop('disabled', false);
            }
        });
    });

    // Initialize
    loadProducts(1);
});