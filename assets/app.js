$(document).ready(function () {
    // Configuration: Replace these with your actual store URL and API keys.
    var baseUrl = 'https://tasty-ideas.de/wp-json/wc/v3';
    var consumerKey = 'ck_16d3b7b2dc3e8de14b797aea3b14da06079b78fb';
    var consumerSecret = 'cs_af1e3fafa1ed1b90ba84ae48cdd83253f249aa2e';

    // Pagination variables
    var currentPage = 1;
    var perPage = 20;
    var totalProducts = 0;

    // Create a Basic Authentication header
    var authHeader = "Basic " + btoa(consumerKey + ":" + consumerSecret);

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
                $button.addClass('is-loading')
                    .prop('disabled', true)
                    .data('original-text', $button.html())
                    .html('');
            } else {
                $button.removeClass('is-loading')
                    .prop('disabled', false)
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
            headers: { 'Authorization': authHeader },
            data: {
                per_page: perPage,
                page: page
            },
            success: function (products, textStatus, request) {
                // Store the response data for debugging
                window.lastApiResponse = {
                    products: products,
                    headers: {
                        total: request.getResponseHeader('X-WP-Total'),
                        totalPages: request.getResponseHeader('X-WP-TotalPages')
                    }
                };

                var tbody = $('#productsTable tbody');
                tbody.empty();

                // Update total products from headers
                totalProducts = parseInt(request.getResponseHeader('X-WP-Total') || 0);
                var totalPages = parseInt(request.getResponseHeader('X-WP-TotalPages') || 0);

                // Update pagination info
                var startItem = (page - 1) * perPage + 1;
                var endItem = Math.min(page * perPage, totalProducts);
                $('#currentPageInfo').text(startItem + '-' + endItem);
                $('#totalProducts').text(totalProducts);

                // Update button states
                $('#prevPage').prop('disabled', page <= 1);
                $('#nextPage').prop('disabled', page >= totalPages);

                displayProducts(products);
            },
            error: function (xhr, status, error) {
                alert('Error fetching products: ' + error);
            },
            complete: function() {
                loadingManager.hideTableLoading();
            }
        });
    }

    function displayProducts(products) {
        const tbody = $('#productsTable tbody');
        tbody.empty();

        products.forEach(product => {
            const imageUrl = product.images && product.images.length > 0 
                ? product.images[0].src 
                : 'https://via.placeholder.com/50x50?text=No+Image';
            
            const row = `<tr>
                <td><img src="${imageUrl}" alt="${product.name}" class="product-thumbnail"></td>
                <td>${product.id}</td>
                <td>${product.name}</td>
                <td>${product.type}</td>
                <td>${product.regular_price ? '€' + product.regular_price : 'N/A'}</td>
                <td>${product.description ? product.description.substring(0, 100) + '...' : ''}</td>
            </tr>`;
            tbody.append(row);
        });
    }

    // Load initial page
    loadProducts(currentPage);

    // Handle pagination clicks
    $('#prevPage').click(function () {
        if (currentPage > 1) {
            currentPage--;
            loadProducts(currentPage);
        }
    });

    $('#nextPage').click(function () {
        currentPage++;
        loadProducts(currentPage);
    });

    // Load products on page load and when switching back to the List tab
    $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        if ($(e.target).attr('href') === '#list') {
            currentPage = 1;
            loadProducts(currentPage);
        }
    });

    // Handle the Create Product form submission
    $('#createProductForm').submit(function (e) {
        e.preventDefault();
        loadingManager.showFormLoading('#createProductForm');
        
        // Basic product data
        var productData = {
            name: $('#productName').val(),
            type: 'simple',
            regular_price: $('#regularPrice').val().toString(),
            sale_price: $('#salePrice').val() ? $('#salePrice').val().toString() : '',
            description: $('#productDescription').val(),
            short_description: $('#shortDescription').val(),
            manage_stock: true,
            stock_status: $('#stockStatus').val(),
            stock_quantity: parseInt($('#stockQuantity').val()) || 0,
            categories: $('#categories').val().map(function (category) {
                return { name: category };
            }),
            attributes: [
                {
                    name: 'Gebinde',
                    position: 0,
                    visible: true,
                    variation: false,
                    options: [$('#gebindeType').val()]
                }
            ],
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
            ]
        };

        // Only add SKU if it's provided
        var sku = $('#productSku').val();
        if (sku && sku.trim() !== '') {
            productData.sku = sku.trim();
        }

        // Set tax status
        if ($('#taxStatus').is(':checked')) {
            productData.tax_status = 'taxable';
        } else {
            productData.tax_status = 'none';
        }

        // Create product
        $.ajax({
            url: baseUrl + '/products',
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(productData),
            success: function (response) {
                $('#createResult').html(
                    '<div class="alert alert-success">' +
                    '<h5>Product created successfully!</h5>' +
                    '<p>Product ID: ' + response.id + '</p>' +
                    '<p>Name: ' + response.name + '</p>' +
                    '</div>'
                );
                $('#createProductForm')[0].reset();
                loadProducts(currentPage);
            },
            error: function (xhr, status, error) {
                var errorMessage = '';
                try {
                    var response = JSON.parse(xhr.responseText);
                    if (response.code === 'product_invalid_sku') {
                        errorMessage = 'The SKU (article number) is already in use. Please choose a different SKU or leave it empty.';
                    } else {
                        errorMessage = response.message;
                    }
                } catch (e) {
                    errorMessage = xhr.responseText;
                }

                $('#createResult').html(
                    '<div class="alert alert-danger">' +
                    '<h5>Error creating product:</h5>' +
                    '<p>' + errorMessage + '</p>' +
                    '</div>'
                );
            },
            complete: function() {
                loadingManager.hideFormLoading('#createProductForm');
            }
        });
    });

    // Add debug button click handler
    $('#debugButton').click(function () {
        if (window.lastApiResponse) {
            console.log('=== WooCommerce API Response Debug ===');
            console.log('Current Page:', currentPage);
            console.log('Products per Page:', perPage);
            console.log('Total Products:', window.lastApiResponse.headers.total);
            console.log('Total Pages:', window.lastApiResponse.headers.totalPages);
            console.log('Products Data:', window.lastApiResponse.products);
            console.log('================================');
        } else {
            console.log('No API response data available yet');
        }
    });

    // Handle product search
    $('#searchProduct').click(function () {
        var productId = $('#searchProductId').val();
        if (!productId) {
            alert('Please enter a product ID');
            return;
        }

        const $searchButton = $(this);
        loadingManager.setButtonLoading($searchButton, true);
        
        $.ajax({
            url: baseUrl + '/products/' + productId,
            method: 'GET',
            headers: { 'Authorization': authHeader },
            success: function (product) {
                // Store the product ID for update
                $('#updateProductId').val(product.id);

                // Fill the form with product data
                $('#updateProductName').val(product.name);
                $('#updateProductSku').val(product.sku);
                $('#updateProductDescription').val(product.description);
                $('#updateShortDescription').val(product.short_description);
                $('#updateRegularPrice').val(product.regular_price);
                $('#updateSalePrice').val(product.sale_price);
                $('#updateStockStatus').val(product.stock_status);
                $('#updateStockQuantity').val(product.stock_quantity);
                $('#updateTaxStatus').prop('checked', product.tax_status === 'taxable');

                // Handle Gebinde attribute
                var gebindeAttr = product.attributes.find(attr => attr.name === 'Gebinde');
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
                var categoryValues = product.categories.map(cat => cat.name);
                $('#updateCategories').val(categoryValues);

                // Show the update form
                $('#updateProductForm').show();
            },
            error: function (xhr, status, error) {
                alert('Error finding product: ' + error);
            },
            complete: function() {
                loadingManager.setButtonLoading($searchButton, false);
            }
        });
    });

    // Handle product update
    $('#productUpdateForm').submit(function (e) {
        e.preventDefault();
        loadingManager.showFormLoading('#productUpdateForm');
        
        var productId = $('#updateProductId').val();

        var productData = {
            name: $('#updateProductName').val(),
            type: 'simple',
            regular_price: $('#updateRegularPrice').val().toString(),
            sale_price: $('#updateSalePrice').val() ? $('#updateSalePrice').val().toString() : '',
            description: $('#updateProductDescription').val(),
            short_description: $('#updateShortDescription').val(),
            manage_stock: true,
            stock_status: $('#updateStockStatus').val(),
            stock_quantity: parseInt($('#updateStockQuantity').val()) || 0,
            categories: $('#updateCategories').val().map(function (category) {
                return { name: category };
            }),
            attributes: [
                {
                    name: 'Gebinde',
                    position: 0,
                    visible: true,
                    variation: false,
                    options: [$('#updateGebindeType').val()]
                }
            ],
            meta_data: [
                {
                    key: '_unit',
                    value: $('#updateUnit').val()
                },
                {
                    key: '_unit_amount',
                    value: $('#updateUnitAmount').val()
                },
                {
                    key: '_delivery_time',
                    value: $('#updateDeliveryTime').val()
                }
            ]
        };

        // Only add SKU if it's provided
        var sku = $('#updateProductSku').val();
        if (sku && sku.trim() !== '') {
            productData.sku = sku.trim();
        }

        // Set tax status
        if ($('#updateTaxStatus').is(':checked')) {
            productData.tax_status = 'taxable';
        } else {
            productData.tax_status = 'none';
        }

        // Update product
        $.ajax({
            url: baseUrl + '/products/' + productId,
            method: 'PUT',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(productData),
            success: function (response) {
                $('#updateResult').html(
                    '<div class="alert alert-success">' +
                    '<h5>Product updated successfully!</h5>' +
                    '<p>Product ID: ' + response.id + '</p>' +
                    '<p>Name: ' + response.name + '</p>' +
                    '</div>'
                );
                loadProducts(currentPage);
            },
            error: function (xhr, status, error) {
                var errorMessage = '';
                try {
                    var response = JSON.parse(xhr.responseText);
                    if (response.code === 'product_invalid_sku') {
                        errorMessage = 'The SKU (article number) is already in use. Please choose a different SKU or leave it empty.';
                    } else {
                        errorMessage = response.message;
                    }
                } catch (e) {
                    errorMessage = xhr.responseText;
                }

                $('#updateResult').html(
                    '<div class="alert alert-danger">' +
                    '<h5>Error updating product:</h5>' +
                    '<p>' + errorMessage + '</p>' +
                    '</div>'
                );
            },
            complete: function() {
                loadingManager.hideFormLoading('#productUpdateForm');
            }
        });
    });

    // Add global AJAX loading indicator
    $(document).ajaxStart(function() {
        loadingManager.showGlobal();
    }).ajaxStop(function() {
        loadingManager.hideGlobal();
    });
});