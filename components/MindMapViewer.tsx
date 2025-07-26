import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Draggable from 'react-native-draggable';
import { PinchGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedGestureHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface MindMapNode {
  label: string;
  children?: MindMapNode[];
}

interface MindMapData {
  root: string;
  nodes: MindMapNode[];
}

interface MindMapViewerProps {
  mindMap: MindMapData;
  editable?: boolean;
  onChange?: (newMap: MindMapData) => void;
  fullScreen?: boolean;
  onCloseFullScreen?: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1200;
const CENTER_X = CANVAS_WIDTH / 2;
const CENTER_Y = CANVAS_HEIGHT / 2;
const MAIN_NODE_SIZE = 120;
const CHILD_NODE_SIZE = 80;
const ROOT_NODE_SIZE = 150;
const MAIN_COLOR = '#1ca3ec';
const CHILD_COLOR = '#fff';
const CHILD_BORDER = '#1ca3ec';

const getInitialPositions = (mindMap: MindMapData) => {
  const positions: { [key: string]: { x: number; y: number } } = {};
  // Center node
  positions['root'] = { x: CENTER_X - ROOT_NODE_SIZE / 2, y: CENTER_Y - ROOT_NODE_SIZE / 2 };
  // Main nodes
  const numMain = mindMap.nodes.length;
  const mainRadius = 350;
  for (let i = 0; i < numMain; i++) {
    const angle = (2 * Math.PI * i) / Math.max(numMain, 1);
    const x = CENTER_X + mainRadius * Math.cos(angle) - MAIN_NODE_SIZE / 2;
    const y = CENTER_Y + mainRadius * Math.sin(angle) - MAIN_NODE_SIZE / 2;
    positions[`main-${i}`] = { x, y };
    // Child nodes
    const node = mindMap.nodes[i];
    if (node.children && node.children.length > 0) {
      const childRadius = 120;
      for (let j = 0; j < node.children.length; j++) {
        const childAngle = angle + ((j - (node.children.length - 1) / 2) * (Math.PI / 6));
        const cx = x + MAIN_NODE_SIZE / 2 + childRadius * Math.cos(childAngle) - CHILD_NODE_SIZE / 2;
        const cy = y + MAIN_NODE_SIZE / 2 + childRadius * Math.sin(childAngle) - CHILD_NODE_SIZE / 2;
        positions[`child-${i}-${j}`] = { x: cx, y: cy };
      }
    }
  }
  return positions;
};

const MindMapViewer: React.FC<MindMapViewerProps> = ({ mindMap, editable = false, onChange, fullScreen = false, onCloseFullScreen }) => {
  const [editMode, setEditMode] = useState(false);
  const [editingNode, setEditingNode] = useState<{ type: 'root' | 'main' | 'child'; mainIdx?: number; childIdx?: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [localMap, setLocalMap] = useState<MindMapData>(mindMap);
  const [nodePositions, setNodePositions] = useState<{ [key: string]: { x: number; y: number } }>(() => getInitialPositions(mindMap));
  const [scale, setScale] = useState(1);
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 2.0;
  // Remove treeMode and radial view, keep only tree view

  // Pinch-to-zoom shared value
  const pinchScale = useSharedValue(1);
  const baseScale = useSharedValue(1);

  // Animated style for canvas
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pinchScale.value }],
  }));

  // Pinch gesture handler
  const pinchHandler = useAnimatedGestureHandler<PinchGestureHandlerGestureEvent>({
    onStart: (_, ctx: any) => {
      ctx.startScale = baseScale.value;
    },
    onActive: (event, ctx: any) => {
      let newScale = ctx.startScale * event.scale;
      if (newScale < MIN_SCALE) newScale = MIN_SCALE;
      if (newScale > MAX_SCALE) newScale = MAX_SCALE;
      pinchScale.value = newScale;
    },
    onEnd: () => {
      baseScale.value = pinchScale.value;
      runOnJS(setScale)(baseScale.value);
    },
  });

  // Sync zoom buttons with pinch scale
  useEffect(() => {
    pinchScale.value = withTiming(scale);
    baseScale.value = scale;
  }, [scale]);

  useEffect(() => {
    setLocalMap(mindMap);
    setNodePositions(getInitialPositions(mindMap));
  }, [mindMap]);

  const handleNodePress = (type: 'root' | 'main' | 'child', mainIdx?: number, childIdx?: number) => {
    let label = '';
    if (type === 'root') label = localMap.root;
    else if (type === 'main' && mainIdx !== undefined) label = localMap.nodes[mainIdx].label;
    else if (type === 'child' && mainIdx !== undefined && childIdx !== undefined) label = localMap.nodes[mainIdx].children?.[childIdx]?.label || '';
    setEditingNode({ type, mainIdx, childIdx });
    setEditValue(label);
  };

  const handleEditSave = () => {
    if (!editingNode) return;
    const updated = { ...localMap, nodes: localMap.nodes.map(n => ({ ...n, children: n.children ? [...n.children] : [] })) };
    if (editingNode.type === 'root') {
      updated.root = editValue;
    } else if (editingNode.type === 'main' && editingNode.mainIdx !== undefined) {
      updated.nodes[editingNode.mainIdx].label = editValue;
    } else if (editingNode.type === 'child' && editingNode.mainIdx !== undefined && editingNode.childIdx !== undefined) {
      updated.nodes[editingNode.mainIdx].children![editingNode.childIdx].label = editValue;
    }
    setLocalMap(updated);
    setEditingNode(null);
    setEditValue('');
    onChange && onChange(updated);
  };

  const handleAddChild = (mainIdx: number) => {
    const updated = { ...localMap, nodes: localMap.nodes.map(n => ({ ...n, children: n.children ? [...n.children] : [] })) };
    if (!updated.nodes[mainIdx].children) updated.nodes[mainIdx].children = [];
    updated.nodes[mainIdx].children!.push({ label: 'New Node' });
    setLocalMap(updated);
    onChange && onChange(updated);
    setNodePositions(getInitialPositions(updated));
  };

  const handleDeleteNode = (type: 'main' | 'child', mainIdx: number, childIdx?: number) => {
    const updated = { ...localMap, nodes: localMap.nodes.map(n => ({ ...n, children: n.children ? [...n.children] : [] })) };
    if (type === 'main') {
      updated.nodes.splice(mainIdx, 1);
    } else if (type === 'child' && childIdx !== undefined) {
      updated.nodes[mainIdx].children!.splice(childIdx, 1);
    }
    setLocalMap(updated);
    onChange && onChange(updated);
    setNodePositions(getInitialPositions(updated));
  };

  const handleAddMainNode = () => {
    const updated = { ...localMap, nodes: [...localMap.nodes, { label: 'New Node' }] };
    setLocalMap(updated);
    onChange && onChange(updated);
    setNodePositions(getInitialPositions(updated));
  };

  // Add a recursive renderNode function
  const renderNode = (
    node: MindMapNode | MindMapData,
    key: string,
    level: number,
    parentPos: { x: number; y: number; siblings: number } | null,
    parentSize: number,
    parentKey: string = '',
    parentIndex: number = 0
  ) => {
    // At level 0, node is MindMapData (has root, nodes)
    // At level > 0, node is MindMapNode (has label, children)
    let label = level === 0 ? (node as MindMapData).root : (node as MindMapNode).label;
    let children = level === 0 ? (node as MindMapData).nodes : (node as MindMapNode).children;

    // Calculate position for this node
    let pos = { x: CENTER_X, y: CENTER_Y };
    let size = ROOT_NODE_SIZE;
    let color = MAIN_COLOR;
    let borderColor = MAIN_COLOR;
    let fontSize = 26;
    let nodeKey = key;
    let nodeType: 'root' | 'main' | 'child' = 'root';
    if (level === 0) {
      pos = nodePositions['root'] || { x: CENTER_X - ROOT_NODE_SIZE / 2, y: CENTER_Y - ROOT_NODE_SIZE / 2 };
      size = ROOT_NODE_SIZE;
      color = MAIN_COLOR;
      fontSize = 26;
      nodeType = 'root';
    } else {
      // Improved: spread children in a wider arc, increase radius with level and number of children
      const siblings = parentPos?.siblings || 1;
      const index = parentIndex;
      // Use a semi-circle (PI radians) for children, not a full circle
      const angleStep = Math.PI / Math.max(1, siblings - 1);
      const angle = Math.PI / 2 + (index - (siblings - 1) / 2) * angleStep;
      // Increase radius with level and number of siblings
      const baseRadius = 180 + level * 120 + siblings * 10;
      pos = {
        x: (parentPos?.x || CENTER_X) + baseRadius * Math.cos(angle),
        y: (parentPos?.y || CENTER_Y) + baseRadius * Math.sin(angle),
      };
      size = level === 1 ? MAIN_NODE_SIZE : CHILD_NODE_SIZE;
      color = level === 1 ? MAIN_COLOR : CHILD_COLOR;
      borderColor = level === 1 ? MAIN_COLOR : CHILD_BORDER;
      fontSize = level === 1 ? 20 : 15;
      nodeType = level === 1 ? 'main' : 'child';
    }

    // Draw line from parent to this node (except root)
    const lines = [];
    if (level > 0 && parentPos) {
      const x1 = parentPos.x + (parentSize || size) / 2;
      const y1 = parentPos.y + (parentSize || size) / 2;
      const x2 = pos.x + size / 2;
      const y2 = pos.y + size / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) + 'rad';
      lines.push(
        <View
          key={`line-${parentKey}-${nodeKey}`}
          style={{
            position: 'absolute',
            left: x1 - length / 2,
            top: y1 - 1,
            width: length,
            height: 2,
            backgroundColor: MAIN_COLOR,
            transform: [{ rotateZ: angle }],
            transformOrigin: 'center',
            zIndex: 0,
          }}
        />
      );
    }

    // Render this node
    const draggableKey = nodeKey;
    return (
      <React.Fragment key={draggableKey}>
        {lines}
        <Draggable
          x={pos.x}
          y={pos.y}
          disabled={!editMode}
          onDragRelease={(_, gestureState) => {
            setNodePositions(posMap => ({ ...posMap, [draggableKey]: { x: gestureState.moveX - size / 2, y: gestureState.moveY - size / 2 } }));
          }}
          shouldReverse={false}
        >
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                borderWidth: nodeType === 'child' ? 3 : 0,
                borderColor: borderColor,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 2,
                elevation: level === 0 ? 6 : level === 1 ? 4 : 2,
                shadowColor: '#000',
                shadowOpacity: 0.08 + 0.07 * (2 - level),
                shadowRadius: 4 + 2 * (2 - level),
                shadowOffset: { width: 0, height: 1 + level },
              }}
              onPress={editMode ? () => handleNodePress(nodeType, parentIndex, undefined) : undefined}
              activeOpacity={0.8}
            >
              <Text style={{ color: nodeType === 'child' ? MAIN_COLOR : '#fff', fontWeight: 'bold', fontSize, textAlign: 'center' }}>{label}</Text>
            </TouchableOpacity>
            {editMode && nodeType === 'main' && (
              <View style={{ flexDirection: 'row', marginTop: 2 }}>
                <TouchableOpacity onPress={() => handleAddChild(parentIndex)} style={{ marginRight: 8 }}>
                  <Text style={{ color: '#43e97b', fontWeight: 'bold', fontSize: 14 }}>+ Child</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteNode('main', parentIndex)}>
                  <Text style={{ color: '#ff6b6b', fontWeight: 'bold', fontSize: 14 }}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
            {editMode && nodeType === 'child' && (
              <TouchableOpacity onPress={() => handleDeleteNode('child', parentIndex, undefined)}>
                <Text style={{ color: '#ff6b6b', fontWeight: 'bold', fontSize: 12 }}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </Draggable>
        {/* Recursively render children */}
        {Array.isArray(children) && children.length > 0 && children.map((child, idx) =>
          renderNode(
            child,
            `${draggableKey}-child${idx}`,
            level + 1,
            { x: pos.x, y: pos.y, siblings: children.length },
            size,
            draggableKey,
            idx
          )
        )}
      </React.Fragment>
    );
  };

  // Plain tree layout: just indentation, no card/border/shadow styles
  const renderTree = (node: MindMapNode | MindMapData, level = 0, parentIdx = 0, isLast = false) => {
    const label = level === 0 ? (node as MindMapData).root : (node as MindMapNode).label;
    const children = level === 0 ? (node as MindMapData).nodes : (node as MindMapNode).children;
    return (
      <View key={label + '-' + parentIdx} style={{ flexDirection: 'column', alignItems: 'flex-start', marginLeft: level * 24, marginVertical: 2, width: '100%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
          <Text style={{
            fontWeight: level === 0 ? 'bold' : 'normal',
            fontSize: level === 0 ? 20 : 15,
            color: '#222',
            marginRight: 8,
          }}>{label}</Text>
          {editable && (
            <TouchableOpacity onPress={() => handleNodePress(level === 0 ? 'root' : level === 1 ? 'main' : 'child', parentIdx)}>
              <Text style={{ color: '#43e97b', fontWeight: 'bold', fontSize: 14, marginRight: 8 }}>Edit</Text>
            </TouchableOpacity>
          )}
          {editable && level === 1 && (
            <TouchableOpacity onPress={() => handleAddChild(parentIdx)} style={{ marginRight: 8 }}>
              <Text style={{ color: '#43e97b', fontWeight: 'bold', fontSize: 14 }}>+ Child</Text>
            </TouchableOpacity>
          )}
          {editable && level === 1 && (
            <TouchableOpacity onPress={() => handleDeleteNode('main', parentIdx)} style={{ marginRight: 8 }}>
              <Text style={{ color: '#ff6b6b', fontWeight: 'bold', fontSize: 14 }}>Delete</Text>
            </TouchableOpacity>
          )}
          {editable && level > 1 && (
            <TouchableOpacity onPress={() => handleDeleteNode('child', parentIdx)} style={{ marginRight: 8 }}>
              <Text style={{ color: '#ff6b6b', fontWeight: 'bold', fontSize: 12 }}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Children */}
        {Array.isArray(children) && children.length > 0 && (
          <View style={{ width: '100%' }}>
            {children.map((child, idx) => (
              <React.Fragment key={child.label + '-' + idx}>
                {renderTree(child, level + 1, idx, idx === children.length - 1)}
                {/* Divider between siblings, not after last */}
                {idx !== children.length - 1 && (
                  <View style={{ height: 1, backgroundColor: '#ececec', marginVertical: 4, width: '100%' }} />
                )}
              </React.Fragment>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
      {/* Top control bar: Edit, Edit Raw, Close */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 8, gap: 8 }}>
        {editable && (
          <TouchableOpacity
            style={{ backgroundColor: editMode ? '#43e97b' : '#96ceb4', padding: 8, borderRadius: 8, marginRight: 8 }}
            onPress={() => setEditMode(!editMode)}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>{editMode ? 'Save' : 'Edit'}</Text>
          </TouchableOpacity>
        )}
        {editMode && editable && (
          <TouchableOpacity
            style={{ backgroundColor: '#96ceb4', padding: 8, borderRadius: 8, marginRight: 8 }}
            onPress={handleAddMainNode}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ Main Node</Text>
          </TouchableOpacity>
        )}
        {/* Edit Raw button if available */}
        {typeof onCloseFullScreen === 'function' && !editMode && (
          <TouchableOpacity
            style={{ backgroundColor: '#f7b731', borderRadius: 20, padding: 8, marginRight: 8, minWidth: 60, alignItems: 'center' }}
            onPress={onCloseFullScreen}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Close</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
        {renderTree(localMap)}
      </ScrollView>
      {/* Edit input overlay */}
      {editMode && editingNode && (
        <View style={{ position: 'absolute', top: 20, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', elevation: 4 }}>
            <TextInput
              value={editValue}
              onChangeText={setEditValue}
              style={{ borderBottomWidth: 1, borderColor: '#96ceb4', minWidth: 120, fontSize: 16, marginRight: 8 }}
              autoFocus
            />
            <TouchableOpacity onPress={handleEditSave} style={{ backgroundColor: '#43e97b', padding: 8, borderRadius: 6 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditingNode(null); setEditValue(''); }} style={{ marginLeft: 8 }}>
              <Text style={{ color: '#ff6b6b', fontWeight: 'bold' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default MindMapViewer; 