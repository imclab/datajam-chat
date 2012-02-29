namespace :datajam_chat do
  desc "Install Chat"
  task :install => :environment do
    DatajamChat::InstallJob.perform
  end

  desc "Uninstall Chat"
  task :uninstall => :environment do
    DatajamChat::UninstallJob.perform
  end

  desc "Refresh static assets"
  task :refresh_assets => :environment do
    DatajamChat::RefreshAssetsJob.perform
  end

  desc "Clear the redis session cache"
  task :clear_sessions => :environment do
    DatajamChat::ClearSessionsJob.perform
  end

  desc "Recache all chat endpoints"
  task :cache_reset => :environment do
    DatajamChat::CacheResetJob.perform
  end

  desc "Concatenate and compile the backbone app after making changes"
  task :build do
    require 'httparty'

    manifest = File.open(File.expand_path('../../../build.manifest', __FILE__), 'r')
    dir = File.expand_path('../../../public/javascripts/datajam_chat', __FILE__)
    build = File.open("#{dir}/app-compiled.js", "w+")

    build.puts <<-EOT.strip_heredoc
      /**
       * Datajam Chat build file
       * Do not edit this file directly -- run `rake datajam_chat:build`
       */

      (function($, define, require){
        if(window.Datajam.DEBUG){
          $.getScript('/javascripts/datajam_chat/app.js');
        }else{
    EOT

    File.open("#{dir}/app.js", "r") do |file|
      until (line = (file.gets || '')) and (line.include?  '// Bootstrap the app')
        build.puts line
      end

      2.times { build.puts("\n") }

      while (line = manifest.gets)
        build.puts(File.open("#{dir}/#{line.chomp}").read.sub("define(", "define('chat/#{line.chomp.sub('.js', '')}', "))
      end

      2.times { build.puts("\n") }

      while (line = file.gets)
        build.puts line
      end
    end

    build.puts <<-EOT.strip_heredoc
        }
      })(jQuery, curl.define, curl);
    EOT

    build.rewind
    code = build.read
    build.close

    compiled = HTTParty::post(
      'http://closure-compiler.appspot.com/compile',
      :body => {
        compilation_level: 'SIMPLE_OPTIMIZATIONS',
        output_format: 'text',
        output_info: 'compiled_code',
        js_code: code})

    if compiled.strip === ''
      raise 'Unable to build with closure compiler. Please ensure your syntax is correct.'
    end


    File.open("#{dir}/app-compiled.min.js", "w+") do |file|
      file.print compiled
    end

  end
end