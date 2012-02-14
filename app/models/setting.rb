class Setting
  # callbacks to be run after save
  def datajam_chat_bitly_username_callback
    query_opts = DatajamChat.bitly.instance_variable_get('@default_query_opts')
    query_opts.update(:login => value)
    DatajamChat.bitly.instance_variable_set('@default_query_opts', query_opts)
  end

  def datajam_chat_bitly_api_key_callback
    query_opts = DatajamChat.bitly.instance_variable_get('@default_query_opts')
    query_opts.update(:apiKey => value)
    DatajamChat.bitly.instance_variable_set('@default_query_opts', query_opts)
  end

end