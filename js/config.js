// 配置文件，方便统一管理设置
const EASTER_EGG_CONFIG = {
    startHour: 10,
    endHour: 12,
    interval: 3000,      // 生成新CC的间隔时间（毫秒）
    animationDuration: 2000,  // 动画持续时间（毫秒）
    maxElements: 10,     // 同时存在的最大CC数量
    minSize: 20,         // 最小字体大小
    maxSize: 40,         // 最大字体大小
    colors: [            // 可能的颜色列表
        '#FF69B4',      // 粉色
        '#FFB6C1',      // 浅粉色
        '#FFC0CB',      // 粉红
        '#FF1493',      // 深粉色
        '#FF69B4',      // 热粉色
    ]
}; 