CREATE DATABASE IF NOT EXISTS world_guesser;
USE world_guesser;

DROP TABLE IF EXISTS locations;

CREATE TABLE locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    image_path VARCHAR(255) NOT NULL
);

INSERT INTO locations (name, latitude, longitude, image_path) VALUES
('Eiffel Tower', 48.8584, 2.2945, 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg'),
('Statue of Liberty', 40.6892, -74.0445, 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Statue_of_Liberty_7.jpg'),
('Taj Mahal', 27.1751, 78.0421, 'https://upload.wikimedia.org/wikipedia/commons/d/da/Taj-Mahal.jpg'),
('Mount Everest', 27.9881, 86.9250, 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Everest_kalapatthar.jpg'),
('Great Wall of China', 40.4319, 116.5704, 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Mutianyu_Great_Wall_2014_07.JPG');
