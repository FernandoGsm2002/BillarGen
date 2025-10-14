"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import { Bell, BellRing, Check, X, Activity, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Notification {
  id: number;
  tenant_id: number;
  recipient_user_id: number;
  sender_user_id: number | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
  read_at: string | null;
}

interface NotificationsProps {
  userId: number;
  tenantId: number;
}

export function NotificationsDropdown({ userId, tenantId }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNotifications();
    
    // Actualizar notificaciones cada 30 segundos
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId, tenantId]);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', userId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        if (!error.message.includes('relation "notifications" does not exist')) {
          console.error('Error cargando notificaciones:', error);
        }
        return;
      }

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Error en loadNotifications:', error);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marcando notificación como leída:', error);
        return;
      }

      // Actualizar estado local
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error en markAsRead:', error);
    }
  };

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .in('id', unreadIds);

      if (error) {
        console.error('Error marcando todas como leídas:', error);
        return;
      }

      // Actualizar estado local
      setNotifications(prev => 
        prev.map(n => ({ 
          ...n, 
          is_read: true, 
          read_at: n.is_read ? n.read_at : new Date().toISOString() 
        }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error en markAllAsRead:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        console.error('Error eliminando notificación:', error);
        return;
      }

      // Actualizar estado local
      const notification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error en deleteNotification:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'session_start':
        return <Activity size={16} className="text-green-600" />;
      case 'session_end':
        return <Clock size={16} className="text-red-600" />;
      default:
        return <Bell size={16} className="text-blue-600" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-9 w-9"
          title="Notificaciones"
        >
          {unreadCount > 0 ? (
            <BellRing size={18} className="text-orange-600" />
          ) : (
            <Bell size={18} />
          )}
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs bg-red-500 text-white border-0 p-0"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-96 max-h-96 overflow-y-auto"
        sideOffset={5}
      >
        <div className="flex items-center justify-between p-4">
          <DropdownMenuLabel className="text-base font-semibold">
            Notificaciones
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              disabled={loading}
              className="text-xs h-7 px-2"
            >
              <Check size={12} className="mr-1" />
              Marcar todas
            </Button>
          )}
        </div>
        
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Bell size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay notificaciones</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="p-0 focus:bg-gray-50"
                onSelect={(e) => e.preventDefault()}
              >
                <div 
                  className={`w-full p-3 border-l-4 ${
                    notification.is_read 
                      ? 'border-transparent bg-white' 
                      : 'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`text-sm font-medium truncate ${
                            notification.is_read ? 'text-gray-700' : 'text-gray-900'
                          }`}>
                            {notification.title}
                          </h4>
                          <span className="text-xs text-gray-400 shrink-0">
                            {formatTimeAgo(notification.created_at)}
                          </span>
                        </div>
                        <p className={`text-sm ${
                          notification.is_read ? 'text-gray-500' : 'text-gray-700'
                        }`}>
                          {notification.message}
                        </p>
                        {notification.metadata?.session_name && (
                          <div className="mt-1">
                            <Badge variant="info" className="text-xs">
                              {notification.metadata.session_name}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                          className="h-6 w-6 p-0 hover:bg-blue-100"
                          title="Marcar como leída"
                        >
                          <Check size={12} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteNotification(notification.id)}
                        className="h-6 w-6 p-0 hover:bg-red-100 text-red-600"
                        title="Eliminar"
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
