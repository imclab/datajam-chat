$:.push File.expand_path("../lib", __FILE__)

# Maintain your gem's version:
require "datajam_chat/version"

# Describe your gem and declare its dependencies:
Gem::Specification.new do |s|
  s.name        = "datajam_chat"
  s.version     = DatajamChat::VERSION
  s.authors     = ["Dan Drinkard"]
  s.email       = ["ddrinkard@sunlightfoundation.com"]
  s.homepage    = "http://datajam.org"
  s.summary     = "A pluggable real-time chat engine for datajam."
  s.description = "Datajam is a real-time, data-driven platform for reporting on live events."

  s.files = Dir["{app,config,db,lib}/**/*"] + ["LICENSE", "Rakefile", "README.md"]

  s.add_dependency "facets", "~> 2.9"
  s.add_dependency "rails", "~> 3.1.0"
  s.add_dependency "jquery-rails", '~> 0.2'
  s.add_dependency 'mongoid', '~> 2.0'
  s.add_dependency 'bson_ext', '~> 1.2'
  s.add_dependency 'carrierwave', '~> 0.5'
  s.add_dependency 'carrierwave-mongoid', '~> 0.1.3'
  s.add_dependency 'mongoid_slug', '~> 0.7'
  s.add_dependency 'rack-gridfs', '~> 0.4'
  s.add_dependency 'bitly', '~>0.6'
  s.add_dependency 'uuidtools', '~> 2.1.2'

end