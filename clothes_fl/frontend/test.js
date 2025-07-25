const API_BASE = "http://localhost:8000";

// DOM元素
const backToMainBtn = document.getElementById('back-to-main');
const excelInput = document.getElementById('excel-input');
const imagesInput = document.getElementById('images-input');
const startTestBtn = document.getElementById('start-test-btn');
const testProgressContainer = document.getElementById('test-progress-container');
const testProgressText = document.getElementById('test-progress-text');
const testProgressPercentage = document.getElementById('test-progress-percentage');
const testProgressFill = document.getElementById('test-progress-fill');
const testStatus = document.getElementById('test-status');
const testResultsSection = document.getElementById('test-results-section');
const errorImagesGrid = document.getElementById('error-images-grid');
const errorDetailModal = document.getElementById('error-detail-modal');

// 返回主页
backToMainBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
});

// 开始测试
startTestBtn.addEventListener('click', async () => {
    const excelFile = excelInput.files[0];
    const imageFiles = imagesInput.files;
    
    if (!excelFile) {
        alert('请选择Excel文件！');
        return;
    }
    
    if (!imageFiles || imageFiles.length === 0) {
        alert('请选择图片文件！');
        return;
    }
    
    // 显示进度条
    testProgressContainer.style.display = 'block';
    startTestBtn.disabled = true;
    startTestBtn.textContent = '测试中...';
    
    try {
        // 1. 上传并解析Excel文件
        updateTestProgress(0, 100, '正在解析Excel文件...');
        const excelData = await uploadAndParseExcel(excelFile);
        
        if (!excelData || excelData.length === 0) {
            throw new Error('Excel文件解析失败或数据为空');
        }
        
        addTestStatusMessage(`✓ Excel文件解析成功，共 ${excelData.length} 条数据`, 'success');
        
        // 2. 批量上传图片并获取AI识别结果
        updateTestProgress(20, 100, '正在批量识别图片...');
        const aiResults = await batchRecognizeImages(imageFiles, excelData);
        
        // 3. 对比结果并计算准确率
        updateTestProgress(80, 100, '正在计算准确率...');
        const comparisonResults = compareResults(excelData, aiResults);
        
        // 4. 显示结果
        updateTestProgress(100, 100, '测试完成！');
        displayTestResults(comparisonResults);
        
        addTestStatusMessage('🎉 测试完成！', 'success');
        
    } catch (error) {
        console.error('测试过程中发生错误:', error);
        addTestStatusMessage(`❌ 测试失败: ${error.message}`, 'error');
    } finally {
        startTestBtn.disabled = false;
        startTestBtn.textContent = '开始测试';
    }
});

// 上传并解析Excel文件
async function uploadAndParseExcel(excelFile) {
    const formData = new FormData();
    formData.append('file', excelFile);
    
    const response = await fetch(`${API_BASE}/test/upload_excel/`, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '上传Excel文件失败');
    }
    
    const result = await response.json();
    return result.data;
}

// 批量识别图片
async function batchRecognizeImages(imageFiles, excelData) {
    const results = [];
    const totalFiles = imageFiles.length;
    
    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const progress = 20 + (i / totalFiles) * 60; // 20%-80%的进度
        
        updateTestProgress(progress, 100, `正在识别: ${file.name} (${i + 1}/${totalFiles})`);
        addTestStatusMessage(`正在处理: ${file.name}`, 'processing');
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(`${API_BASE}/upload/`, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                results.push({
                    filename: file.name,
                    ai_result: result,
                    success: true
                });
                addTestStatusMessage(`✓ 识别完成: ${file.name}`, 'success');
            } else {
                const errorData = await response.json();
                results.push({
                    filename: file.name,
                    error: errorData.detail || '识别失败',
                    success: false
                });
                addTestStatusMessage(`✗ 识别失败: ${file.name}`, 'error');
            }
        } catch (error) {
            results.push({
                filename: file.name,
                error: error.message,
                success: false
            });
            addTestStatusMessage(`✗ 网络错误: ${file.name}`, 'error');
        }
    }
    
    return results;
}

// 对比结果并计算准确率
function compareResults(excelData, aiResults) {
    const dimensions = ['color', 'style', 'collar', 'sleeve'];
    const dimensionNames = {
        'color': '颜色',
        'style': '样式', 
        'collar': '领型',
        'sleeve': '袖型'
    };
    
    let totalComparisons = 0;
    let totalCorrect = 0;
    const dimensionStats = {};
    const errorImages = [];
    
    // 初始化维度统计
    dimensions.forEach(dim => {
        dimensionStats[dim] = { correct: 0, total: 0 };
    });
    
    // 创建文件名到Excel数据的映射
    const excelMap = {};
    excelData.forEach(row => {
        if (row.filename) {
            excelMap[row.filename] = row;
        }
    });
    
    // 对比每个AI识别结果
    aiResults.forEach(aiResult => {
        if (!aiResult.success) return;
        
        const filename = aiResult.filename;
        const correctData = excelMap[filename];
        
        if (!correctData) {
            console.warn(`未找到文件 ${filename} 的正确标签数据`);
            return;
        }
        
        const aiTags = aiResult.ai_result.parsed_tags || {};
        const imageErrors = [];
        
        // 对比四个维度
        dimensions.forEach(dimension => {
            const correctValue = correctData[dimension];
            const aiValue = aiTags[dimension];
            
            if (correctValue && correctValue !== '未知') {
                dimensionStats[dimension].total++;
                totalComparisons++;
                
                if (correctValue === aiValue) {
                    dimensionStats[dimension].correct++;
                    totalCorrect++;
                } else {
                    imageErrors.push({
                        dimension: dimensionNames[dimension],
                        correct: correctValue,
                        ai: aiValue || '未识别'
                    });
                }
            }
        });
        
        // 如果有错误，添加到错误图片列表
        if (imageErrors.length > 0) {
            errorImages.push({
                filename: filename,
                imageId: aiResult.ai_result.id,
                errors: imageErrors,
                correctTags: correctData,
                aiTags: aiTags
            });
        }
    });
    
    // 计算准确率
    const overallAccuracy = totalComparisons > 0 ? (totalCorrect / totalComparisons * 100) : 0;
    const dimensionAccuracies = {};
    
    dimensions.forEach(dim => {
        const stats = dimensionStats[dim];
        dimensionAccuracies[dim] = stats.total > 0 ? (stats.correct / stats.total * 100) : 0;
    });
    
    return {
        overallAccuracy: overallAccuracy.toFixed(1),
        dimensionAccuracies,
        errorImages,
        totalComparisons,
        totalCorrect
    };
}

// 显示测试结果
function displayTestResults(results) {
    // 显示总体准确率
    document.getElementById('overall-accuracy').textContent = `${results.overallAccuracy}%`;
    
    // 显示各维度准确率
    document.getElementById('color-accuracy').textContent = `${results.dimensionAccuracies.color.toFixed(1)}%`;
    document.getElementById('style-accuracy').textContent = `${results.dimensionAccuracies.style.toFixed(1)}%`;
    document.getElementById('collar-accuracy').textContent = `${results.dimensionAccuracies.collar.toFixed(1)}%`;
    document.getElementById('sleeve-accuracy').textContent = `${results.dimensionAccuracies.sleeve.toFixed(1)}%`;
    
    // 显示错误图片
    displayErrorImages(results.errorImages);
    
    // 显示结果区域
    testResultsSection.style.display = 'block';
    testResultsSection.scrollIntoView({ behavior: 'smooth' });
}

// 显示错误图片
function displayErrorImages(errorImages) {
    errorImagesGrid.innerHTML = '';
    
    if (errorImages.length === 0) {
        errorImagesGrid.innerHTML = '<p style="text-align: center; color: #10b981; font-weight: 600;">🎉 所有图片识别正确！</p>';
        return;
    }
    
    errorImages.forEach(errorImage => {
        const errorCard = document.createElement('div');
        errorCard.className = 'error-card';
        errorCard.innerHTML = `
            <img src="${API_BASE}/imagefile/${errorImage.filename}" alt="${errorImage.filename}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjEwMCIgeT0iNzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+5Zu+54mH5Yqg6L295aSx6LSlPC90ZXh0Pgo8L3N2Zz4K'">
            <div class="error-info">
                ${errorImage.errors.length} 个维度错误
            </div>
        `;
        
        // 点击显示详情
        errorCard.addEventListener('click', () => {
            showErrorDetail(errorImage);
        });
        
        errorImagesGrid.appendChild(errorCard);
    });
}

// 显示错误详情弹窗
function showErrorDetail(errorImage) {
    document.getElementById('error-detail-image').src = `${API_BASE}/imagefile/${errorImage.filename}`;
    
    // 显示正确标签
    const correctTagsContent = document.getElementById('correct-tags-content');
    correctTagsContent.innerHTML = `
        <div class="tag-item-comparison"><span>颜色:</span><span>${errorImage.correctTags.color || '未知'}</span></div>
        <div class="tag-item-comparison"><span>样式:</span><span>${errorImage.correctTags.style || '未知'}</span></div>
        <div class="tag-item-comparison"><span>领型:</span><span>${errorImage.correctTags.collar || '未知'}</span></div>
        <div class="tag-item-comparison"><span>袖型:</span><span>${errorImage.correctTags.sleeve || '未知'}</span></div>
    `;
    
    // 显示AI标签
    const aiTagsContent = document.getElementById('ai-tags-content');
    aiTagsContent.innerHTML = `
        <div class="tag-item-comparison"><span>颜色:</span><span>${errorImage.aiTags.color || '未识别'}</span></div>
        <div class="tag-item-comparison"><span>样式:</span><span>${errorImage.aiTags.style || '未识别'}</span></div>
        <div class="tag-item-comparison"><span>领型:</span><span>${errorImage.aiTags.collar || '未识别'}</span></div>
        <div class="tag-item-comparison"><span>袖型:</span><span>${errorImage.aiTags.sleeve || '未识别'}</span></div>
    `;
    
    errorDetailModal.style.display = 'block';
}

// 关闭弹窗
document.querySelector('.close').addEventListener('click', () => {
    errorDetailModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === errorDetailModal) {
        errorDetailModal.style.display = 'none';
    }
});

// 更新测试进度
function updateTestProgress(current, total, message) {
    const percentage = Math.round((current / total) * 100);
    testProgressFill.style.width = `${percentage}%`;
    testProgressPercentage.textContent = `${percentage}%`;
    testProgressText.textContent = message;
}

// 添加测试状态消息
function addTestStatusMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = type;
    messageDiv.textContent = message;
    testStatus.appendChild(messageDiv);
    testStatus.scrollTop = testStatus.scrollHeight;
}