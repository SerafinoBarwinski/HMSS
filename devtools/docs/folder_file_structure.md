# Movies
media/movie/$group/$movie

# Music
media/music/$artist/$album/$song

# Shows
media/shows/$show/$episode

# Tuner
Virtual Directory.

# Database and Meta
In every content folder (e.g. media/shows/rickandmorty/S1E1/) is a meta.yaml file which provides the Metadata.
Also per Show/Movie Group/Album there will be a meta.yaml file for like Descriptions and stuff.

# Metadata
This includes Full Name, Description, Poster Image Path (can also be an external URl which will be proxied!) and more
Posters and other Images will be stored in the same folder.

# Handling specific cases
Q: What if there are multiple Video or Audio Files?
A: The user will be displayed multiple options on the Content Page, but the highest quality will be recommended

# Example folder structure
media/shows/rickandmorty/
    meta.yaml
    poster.png
    S1E1/
        meta.yaml
        "School of Rick 4K.mkv"
        SchoolofRickHd.mp4
        poster.jpg
        subtitle.srt
