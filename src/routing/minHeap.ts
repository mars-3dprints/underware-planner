/** Binary min-heap of numeric values ordered by numeric keys. */
export class MinHeap {
  private keys: number[] = [];
  private values: number[] = [];

  get size() {
    return this.keys.length;
  }

  push(key: number, value: number) {
    const { keys, values } = this;
    let i = keys.length;
    keys.push(key);
    values.push(value);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= key) break;
      keys[i] = keys[parent];
      values[i] = values[parent];
      i = parent;
    }
    keys[i] = key;
    values[i] = value;
  }

  /** Removes and returns the [key, value] with the smallest key. */
  pop(): [number, number] {
    const { keys, values } = this;
    const topKey = keys[0];
    const topValue = values[0];
    const lastKey = keys.pop()!;
    const lastValue = values.pop()!;
    if (keys.length) {
      let i = 0;
      const n = keys.length;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= n) break;
        if (child + 1 < n && keys[child + 1] < keys[child]) child++;
        if (keys[child] >= lastKey) break;
        keys[i] = keys[child];
        values[i] = values[child];
        i = child;
      }
      keys[i] = lastKey;
      values[i] = lastValue;
    }
    return [topKey, topValue];
  }
}
