import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useThemeContext } from '../providers/ThemeProvider';
import { getAnswerFromGemini } from '../services/geminiServices';
import subscriptionService from '../services/subscriptionService';

const { width, height } = Dimensions.get('window');

// Dynamic color scheme based on theme
const getColors = (isDark: boolean) => ({
  primary: '#667eea',
  accentColor: '#667eea',
  dangerColor: '#ff6b6b',
  successColor: '#10b981',
  backgroundColor: isDark ? '#0f0f0f' : '#f8f9fa',
  cardColor: isDark ? '#1a1a1a' : '#ffffff',
  headerBackground: isDark ? '#1a1a1a' : '#ffffff',
  borderColor: isDark ? '#333333' : '#f0f0f0',
  iconColor: isDark ? '#9BA1A6' : '#888',
  textColor: {
    primary: isDark ? '#ffffff' : '#1a1a1a',
    secondary: isDark ? '#cccccc' : '#666',
    light: isDark ? '#999999' : '#aaa',
    white: '#ffffff',
  },
  chatColors: {
    user: isDark ? '#667eea' : '#667eea',
    ai: isDark ? '#2a2a2a' : '#f0f0f0',
  },
});

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface NoteChatModalProps {
  visible: boolean;
  onClose: () => void;
  noteTitle: string;
  noteContent: string;
  accentColor?: string;
}

const NoteChatModal: React.FC<NoteChatModalProps> = ({
  visible,
  onClose,
  noteTitle,
  noteContent,
  accentColor,
}) => {
  const { resolvedTheme } = useThemeContext();
  const COLORS = getColors(resolvedTheme === 'dark');
  const finalAccentColor = accentColor || COLORS.accentColor;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const inputAnim = useRef(new Animated.Value(0)).current;

  // FlatList ref for auto-scroll
  const flatListRef = useRef<FlatList>(null);

  // Start animations when modal becomes visible
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Add welcome message
      if (messages.length === 0) {
        const welcomeMessage: ChatMessage = {
          id: 'welcome',
          type: 'ai',
          content: `Hi! I'm your AI study assistant. I've read your note "${noteTitle}" and I'm ready to help you understand it better. Ask me anything about the content!`,
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
      }
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      slideAnim.setValue(50);
    }
  }, [visible]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };

    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Check credits
      const creditResult = await subscriptionService.spendCredits(1);
      if (!creditResult.success) {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          type: 'ai',
          content: creditResult.error || 'Sorry, you need at least 1 credit to ask questions. Please get more credits to continue.',
          timestamp: new Date(),
        };
        setMessages(prev => prev.filter(msg => !msg.isLoading).concat(errorMessage));
        setIsLoading(false);
        return;
      }

      // Create context for AI
      const context = `Based on this note titled "${noteTitle}" with the following content:\n\n${noteContent}\n\nPlease answer this question: ${inputText.trim()}`;
      
      const aiResponse = await getAnswerFromGemini(context, 'note-chat');
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        type: 'ai',
        content: aiResponse,
        timestamp: new Date(),
      };

      setMessages(prev => prev.filter(msg => !msg.isLoading).concat(aiMessage));
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        type: 'ai',
        content: 'Sorry, I encountered an error while processing your question. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => prev.filter(msg => !msg.isLoading).concat(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={[
      styles.messageContainer,
      item.type === 'user' ? styles.userMessageContainer : styles.aiMessageContainer
    ]}>
      <View style={[
        styles.messageBubble,
        {
          backgroundColor: item.type === 'user' ? COLORS.chatColors.user : COLORS.chatColors.ai,
          alignSelf: item.type === 'user' ? 'flex-end' : 'flex-start',
        }
      ]}>
        {item.isLoading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingDots}>
              <Animated.View style={[styles.loadingDot, { backgroundColor: COLORS.textColor.light }]} />
              <Animated.View style={[styles.loadingDot, { backgroundColor: COLORS.textColor.light }]} />
              <Animated.View style={[styles.loadingDot, { backgroundColor: COLORS.textColor.light }]} />
            </View>
          </View>
        ) : (
          <Text style={[
            styles.messageText,
            { color: item.type === 'user' ? COLORS.textColor.white : COLORS.textColor.primary }
          ]}>
            {item.content}
          </Text>
        )}
        <Text style={[
          styles.messageTime,
          { color: item.type === 'user' ? COLORS.textColor.white : COLORS.textColor.light }
        ]}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    </View>
  );

  const resetChat = () => {
    setMessages([]);
    setInputText('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.modalSafeAreaView, { backgroundColor: COLORS.backgroundColor }]}>
        <Animated.View 
          style={[
            styles.modalContainer, 
            { backgroundColor: COLORS.backgroundColor },
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim }
              ]
            }
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: COLORS.borderColor }]}>
            <View style={styles.headerContent}>
              <View style={styles.headerInfo}>
                <View style={[styles.noteIcon, { backgroundColor: finalAccentColor }]}>
                  <Ionicons name="document-text-outline" size={20} color={COLORS.textColor.white} />
                </View>
                <View style={styles.headerText}>
                  <Text style={[styles.headerTitle, { color: COLORS.textColor.primary }]}>Chat with Note</Text>
                  <Text style={[styles.noteTitle, { color: COLORS.textColor.secondary }]} numberOfLines={1}>
                    {noteTitle}
                  </Text>
                </View>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity 
                  style={[styles.headerButton, { backgroundColor: COLORS.cardColor }]}
                  onPress={resetChat}
                >
                  <Ionicons name="refresh-outline" size={20} color={COLORS.textColor.secondary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.headerButton, { backgroundColor: COLORS.cardColor }]}
                  onPress={onClose}
                >
                  <Ionicons name="close" size={20} color={COLORS.textColor.secondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Chat Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {/* Input Section */}
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.inputContainer}
          >
            <View style={[styles.inputWrapper, { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor }]}>
              <TextInput
                style={[styles.textInput, { color: COLORS.textColor.primary }]}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask about your note..."
                placeholderTextColor={COLORS.textColor.light}
                multiline
                maxLength={500}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  { 
                    backgroundColor: inputText.trim() && !isLoading ? finalAccentColor : COLORS.borderColor,
                    opacity: inputText.trim() && !isLoading ? 1 : 0.5
                  }
                ]}
                onPress={handleSendMessage}
                disabled={!inputText.trim() || isLoading}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={inputText.trim() && !isLoading ? COLORS.textColor.white : COLORS.textColor.light} 
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalSafeAreaView: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 12 : 28,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  noteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  loadingContainer: {
    paddingVertical: 8,
  },
  loadingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.6,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
    paddingRight: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NoteChatModal; 