class ChatMessage

  include Mongoid::Document
  include Mongoid::Timestamps

  field :display_name,    type: String
  field :text,            type: String
  field :is_public,       type: Boolean,  default: false
  field :is_moderated,    type: Boolean,  default: false

  belongs_to :chat,   class_name: "Chat",     inverse_of: :messages
  belongs_to :page,   class_name: "ChatPage", inverse_of: :messages
  belongs_to :user

  validates_presence_of :chat
  validates_presence_of :display_name
  validates_length_of :text,  allow_blank: false,  maximum: 1000

  validate :chat_is_open?

  before_save :shorten_urls, :paginate

  def approve
    update_attributes(:is_public => true, :is_moderated => true)
  end

  def reject
    update_attributes(:is_public => false, :is_moderated => true)
  end

  def as_json(options={})
    @user = user.as_json rescue nil
    super(:except => [:user_id, :chat_id, :page_id]).merge({:user => @user})
  end

  def update_with(options)
    original_page = self.page
    # set accessible attrs
    if options
      self.attributes = options.keep_if {|key, val| accessible_attrs.include? key.to_sym}
    end
    if valid?
      # depaginate if it already had a page
      if original_page
        original_page.messages.delete(self)
        original_page.save
      end
    end
    save
  end


  protected

  def accessible_attrs
    [:text, :is_public, :is_moderated]
  end

  def paginate
    if is_public? && page_id.nil?
      self.chat.current_page.messages.concat([ self ])
      self.page.save
    end
  end

  def shorten_urls
    self.text = self.text.gsub(/https?:\/\/[\w\-\/#\.%\?=&:,|]+[\w\-\/#=&]/) do |long_url|
      unless long_url =~ /\.(png|gif|jpe?g|bmp)$/
        begin
          DatajamChat::bitly.shorten(long_url).short_url
        rescue
          long_url
        end
      else long_url
      end
    end rescue text
  end

  def chat_is_open?
    unless self.chat && self.chat.is_open?
      errors.add(:chat, "is closed for comments")
    end
  end

end
