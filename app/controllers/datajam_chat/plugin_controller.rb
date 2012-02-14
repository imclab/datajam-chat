class DatajamChat::PluginController < ApplicationController

  before_filter :authenticate_user!

  def install
    begin
      DatajamChat.install
      flash[:notice] = "Plugin installed."
      redirect_to plugin_settings_path('datajam_chat')
    rescue
      flash[:error] = "Failed to install plugin: #{$!}"
      redirect_to admin_plugins_path
    end
  end

  def uninstall
    begin
      DatajamChat.uninstall
      flash[:notice] = "Plugin uninstalled."
      redirect_to admin_plugins_path
    rescue
      flash[:error] = "Failed to uninstall plugin: #{$!}"
      redirect_to plugin_settings_path('datajam_chat')
    end
  end

  def clear_sessions
    begin
      DatajamChat.clear_sessions
      flash[:notice] = "Chat sessions cleared."
    rescue
      flash[:error] = "Failed to clear sessions: #{$!}"
    end
    redirect_to plugin_settings_path('datajam_chat')
  end

end