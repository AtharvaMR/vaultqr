const dijkstra = {
  find_path: function (graph, s, d) {
    const distances = {};
    const visited = {};
    const previous = {};
    const nodes = Object.keys(graph);
    for (let i = 0; i < nodes.length; i++) {
      distances[nodes[i]] = Infinity;
    }
    distances[s] = 0;

    while (nodes.length) {
      nodes.sort(function (a, b) {
        return distances[a] - distances[b];
      });
      const closest = nodes.shift();
      if (distances[closest] === Infinity) break;
      if (closest === d) break;
      visited[closest] = true;

      for (const neighbor in graph[closest]) {
        if (!visited[neighbor]) {
          const newDist = distances[closest] + graph[closest][neighbor];
          if (newDist < distances[neighbor]) {
            distances[neighbor] = newDist;
            previous[neighbor] = closest;
          }
        }
      }
    }

    const path = [];
    let current = d;
    while (current) {
      path.unshift(current);
      current = previous[current];
    }
    return path;
  },
};

module.exports = dijkstra;
