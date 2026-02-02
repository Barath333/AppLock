// Performance optimization utilities
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Optimize AsyncStorage operations
export const batchAsyncStorage = {
  operations: [],
  timer: null,
  
  addOperation: (key, value) => {
    batchAsyncStorage.operations.push({ key, value });
    
    if (!batchAsyncStorage.timer) {
      batchAsyncStorage.timer = setTimeout(() => {
        batchAsyncStorage.executeBatch();
      }, 100);
    }
  },
  
  executeBatch: async () => {
    if (batchAsyncStorage.operations.length === 0) return;
    
    const batch = [...batchAsyncStorage.operations];
    batchAsyncStorage.operations = [];
    batchAsyncStorage.timer = null;
    
    try {
      const multiSet = batch.map(op => [op.key, op.value]);
      await AsyncStorage.multiSet(multiSet);
      console.log(`✅ Batch saved ${batch.length} items`);
    } catch (error) {
      console.error('❌ Batch save error:', error);
    }
  }
};