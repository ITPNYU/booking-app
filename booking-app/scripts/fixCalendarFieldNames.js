/**
 * 修复 Firestore 中的日历字段名称和重复数据
 * 
 * 问题：
 * 1. 字段名是 calendarIdProd 而不是 calendarProdId
 * 2. calendarId 和 calendarIdProd 的值完全相同（镜像）
 * 3. 命名不清晰，calendarId 应该改为 calendarIdDev
 * 
 * 解决方案：
 * - 保留 calendarIdProd（生产日历）
 * - 添加 calendarIdDev（开发日历）
 * - 保留 calendarId 作为后备（指向开发日历）
 */

const admin = require('firebase-admin');

// 初始化 Firebase Admin
// 取消注释并配置你的凭证
// admin.initializeApp({
//   credential: admin.credential.applicationDefault(),
//   projectId: 'your-project-id'
// });

const db = admin.firestore();

/**
 * 开发环境日历 ID 映射
 * TODO: 填入每个房间的开发/测试日历 ID
 */
const DEV_CALENDAR_MAPPING = {
  202: 'dev_calendar_202@group.calendar.google.com',
  220: 'dev_calendar_220@group.calendar.google.com',
  221: 'dev_calendar_221@group.calendar.google.com',
  222: 'dev_calendar_222@group.calendar.google.com',
  223: 'dev_calendar_223@group.calendar.google.com',
  224: 'dev_calendar_224@group.calendar.google.com',
  230: 'dev_calendar_230@group.calendar.google.com',
  233: 'dev_calendar_233@group.calendar.google.com',
  260: 'dev_calendar_260@group.calendar.google.com',
  1201: 'dev_calendar_1201@group.calendar.google.com',
};

/**
 * 分析当前 Firestore 数据结构
 */
async function analyzeCurrentStructure(tenantId) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 分析租户数据结构: ${tenantId}`);
  console.log(`${'='.repeat(70)}\n`);

  const tenantDoc = await db.collection('tenantSchema').doc(tenantId).get();
  
  if (!tenantDoc.exists) {
    console.error(`❌ 找不到租户文档: ${tenantId}`);
    return null;
  }

  const data = tenantDoc.data();
  const resources = data.resources || [];

  console.log(`租户名称: ${data.name || tenantId}`);
  console.log(`资源数量: ${resources.length}\n`);

  // 分析每个资源的字段
  const analysis = {
    total: resources.length,
    hasCalendarId: 0,
    hasCalendarIdDev: 0,
    hasCalendarIdProd: 0,
    hasCalendarProdId: 0,
    hasDuplicateValues: 0,
    needsFix: 0,
  };

  console.log('资源详情分析：\n');

  resources.forEach((resource, index) => {
    const roomId = resource.roomId;
    const calendarId = resource.calendarId;
    const calendarIdDev = resource.calendarIdDev;
    const calendarIdProd = resource.calendarIdProd;
    const calendarProdId = resource.calendarProdId;

    console.log(`${index + 1}. 房间 ${roomId} - ${resource.name}`);

    // 统计字段
    if (calendarId) {
      analysis.hasCalendarId++;
      console.log(`   ✓ calendarId: ${calendarId.substring(0, 40)}...`);
    }
    if (calendarIdDev) {
      analysis.hasCalendarIdDev++;
      console.log(`   ✓ calendarIdDev: ${calendarIdDev.substring(0, 40)}...`);
    }
    if (calendarIdProd) {
      analysis.hasCalendarIdProd++;
      console.log(`   ✓ calendarIdProd: ${calendarIdProd.substring(0, 40)}...`);
    }
    if (calendarProdId) {
      analysis.hasCalendarProdId++;
      console.log(`   ✓ calendarProdId: ${calendarProdId.substring(0, 40)}...`);
    }

    // 检查重复值
    if (calendarId && calendarIdProd && calendarId === calendarIdProd) {
      analysis.hasDuplicateValues++;
      console.log(`   ⚠️  警告: calendarId 和 calendarIdProd 值相同（镜像）`);
    }

    // 检查是否需要修复
    const needsDevCalendar = !calendarIdDev && DEV_CALENDAR_MAPPING[roomId];
    const hasMirroredData = calendarId === calendarIdProd;

    if (needsDevCalendar || hasMirroredData) {
      analysis.needsFix++;
      console.log(`   🔧 需要修复`);
    }

    console.log('');
  });

  // 打印统计
  console.log(`${'='.repeat(70)}`);
  console.log('统计摘要：');
  console.log(`  总资源数: ${analysis.total}`);
  console.log(`  有 calendarId 字段: ${analysis.hasCalendarId}`);
  console.log(`  有 calendarIdDev 字段: ${analysis.hasCalendarIdDev}`);
  console.log(`  有 calendarIdProd 字段: ${analysis.hasCalendarIdProd}`);
  console.log(`  有 calendarProdId 字段: ${analysis.hasCalendarProdId}`);
  console.log(`  发现镜像数据: ${analysis.hasDuplicateValues}`);
  console.log(`  需要修复: ${analysis.needsFix}`);
  console.log(`${'='.repeat(70)}\n`);

  return { data, analysis };
}

/**
 * 修复日历字段名称和数据
 */
async function fixCalendarFields(tenantId, dryRun = true) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔧 修复日历字段: ${tenantId}`);
  console.log(`模式: ${dryRun ? '🔍 预演模式（不会修改数据）' : '⚡ 执行模式（将修改数据）'}`);
  console.log(`${'='.repeat(70)}\n`);

  try {
    const tenantDocRef = db.collection('tenantSchema').doc(tenantId);
    const tenantDoc = await tenantDocRef.get();

    if (!tenantDoc.exists) {
      console.error(`❌ 找不到租户文档: ${tenantId}`);
      return;
    }

    const data = tenantDoc.data();
    const resources = data.resources || [];

    console.log(`开始处理 ${resources.length} 个资源...\n`);

    const updatedResources = resources.map((resource, index) => {
      const roomId = resource.roomId;
      console.log(`${index + 1}. 处理房间 ${roomId} - ${resource.name}`);

      const currentCalendarId = resource.calendarId;
      const currentCalendarIdProd = resource.calendarIdProd;
      const currentCalendarIdDev = resource.calendarIdDev;

      console.log(`   当前 calendarId: ${currentCalendarId || '未设置'}`);
      console.log(`   当前 calendarIdProd: ${currentCalendarIdProd || '未设置'}`);
      console.log(`   当前 calendarIdDev: ${currentCalendarIdDev || '未设置'}`);

      // 决定新的值
      let newCalendarIdDev = currentCalendarIdDev;
      let newCalendarIdProd = currentCalendarIdProd;
      let newCalendarId = currentCalendarId;

      // 1. 如果 calendarIdProd 存在且与 calendarId 相同（镜像问题）
      if (currentCalendarIdProd && currentCalendarId === currentCalendarIdProd) {
        console.log(`   ⚠️  检测到镜像数据`);
        
        // 如果有配置的开发日历，使用它
        if (DEV_CALENDAR_MAPPING[roomId]) {
          newCalendarIdDev = DEV_CALENDAR_MAPPING[roomId];
          newCalendarId = DEV_CALENDAR_MAPPING[roomId];
          console.log(`   ✨ 将使用配置的开发日历`);
        } else {
          console.log(`   ⚠️  警告: 房间 ${roomId} 没有配置开发日历 ID`);
          console.log(`   ℹ️  保持 calendarIdProd 作为生产日历`);
          console.log(`   ℹ️  calendarId 将作为开发日历（需要手动更新）`);
        }
      }

      // 2. 如果没有 calendarIdDev，但有开发日历配置
      if (!currentCalendarIdDev && DEV_CALENDAR_MAPPING[roomId]) {
        newCalendarIdDev = DEV_CALENDAR_MAPPING[roomId];
        newCalendarId = DEV_CALENDAR_MAPPING[roomId];
        console.log(`   ✨ 添加 calendarIdDev 字段`);
      }

      // 3. 如果没有 calendarIdProd，但 calendarId 看起来像生产日历
      if (!currentCalendarIdProd && currentCalendarId) {
        // 假设当前的 calendarId 是生产日历（需要用户确认）
        if (!DEV_CALENDAR_MAPPING[roomId]) {
          console.log(`   ℹ️  建议: 将当前 calendarId 复制到 calendarIdProd`);
          console.log(`   ℹ️  并在 DEV_CALENDAR_MAPPING 中配置开发日历`);
        }
      }

      console.log(`   → 新的 calendarId (后备): ${newCalendarId}`);
      console.log(`   → 新的 calendarIdDev (开发): ${newCalendarIdDev || '未设置'}`);
      console.log(`   → 新的 calendarIdProd (生产): ${newCalendarIdProd || '未设置'}`);

      // 构建更新后的资源对象
      const updated = {
        ...resource,
        calendarId: newCalendarId,
      };

      // 只添加非空字段
      if (newCalendarIdDev) {
        updated.calendarIdDev = newCalendarIdDev;
      }
      if (newCalendarIdProd) {
        updated.calendarIdProd = newCalendarIdProd;
      }

      // 删除旧的 calendarProdId 字段（如果存在）
      if (resource.calendarProdId) {
        console.log(`   🗑️  删除旧字段: calendarProdId`);
        delete updated.calendarProdId;
      }

      console.log('');
      return updated;
    });

    console.log(`${'='.repeat(70)}`);
    console.log('修复摘要：');
    console.log(`  处理的资源数: ${updatedResources.length}`);
    console.log(`  有开发日历的资源: ${updatedResources.filter(r => r.calendarIdDev).length}`);
    console.log(`  有生产日历的资源: ${updatedResources.filter(r => r.calendarIdProd).length}`);
    console.log(`  仍需手动配置: ${updatedResources.filter(r => !r.calendarIdDev || !r.calendarIdProd).length}`);
    console.log(`${'='.repeat(70)}\n`);

    if (!dryRun) {
      // 应用更新
      await tenantDocRef.update({
        resources: updatedResources
      });
      console.log('✅ 字段已成功更新到 Firestore！\n');
    } else {
      console.log('ℹ️  预演模式 - 没有修改 Firestore 数据');
      console.log('   要应用更改，请使用: fixCalendarFields(tenant, false)\n');
    }

  } catch (error) {
    console.error('❌ 修复字段时出错:', error);
    throw error;
  }
}

/**
 * 主执行函数
 */
async function main() {
  const tenant = process.argv[2] || 'mc';
  const command = process.argv[3] || 'analyze';

  console.log('\n🔧 Firestore 日历字段修复工具\n');

  if (!admin.apps.length) {
    console.error('❌ Firebase Admin 未初始化');
    console.error('   请取消注释并配置 admin.initializeApp() 部分\n');
    process.exit(1);
  }

  try {
    if (command === 'analyze') {
      // 只分析，不修改
      await analyzeCurrentStructure(tenant);
      console.log('💡 提示：运行 `node fixCalendarFieldNames.js mc fix-dry` 预览修复');
      console.log('💡 提示：运行 `node fixCalendarFieldNames.js mc fix-apply` 应用修复\n');
    } else if (command === 'fix-dry') {
      // 预演修复
      await analyzeCurrentStructure(tenant);
      await fixCalendarFields(tenant, true);
    } else if (command === 'fix-apply') {
      // 应用修复
      await analyzeCurrentStructure(tenant);
      
      console.log('⚠️  警告：即将修改 Firestore 数据！');
      console.log('确认要继续吗？ (这个脚本需要在确认后手动运行)\n');
      
      await fixCalendarFields(tenant, false);
    } else {
      console.log('用法:');
      console.log('  node fixCalendarFieldNames.js <tenant> [command]');
      console.log('');
      console.log('命令:');
      console.log('  analyze    - 分析当前数据结构（默认）');
      console.log('  fix-dry    - 预演修复（不修改数据）');
      console.log('  fix-apply  - 应用修复（修改数据）');
      console.log('');
      console.log('示例:');
      console.log('  node fixCalendarFieldNames.js mc analyze');
      console.log('  node fixCalendarFieldNames.js mc fix-dry');
      console.log('  node fixCalendarFieldNames.js mc fix-apply\n');
      process.exit(1);
    }

    console.log('✅ 完成\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { analyzeCurrentStructure, fixCalendarFields };

