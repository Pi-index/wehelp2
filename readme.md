```sql
CREATE DATABASE `taipei_travel` 

CREATE TABLE `major` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `CAT` varchar(255) DEFAULT NULL,
  `description` text,
  `address` varchar(255) DEFAULT NULL,
  `direction` text,
  `MRT` varchar(255) DEFAULT NULL,
  `SERIAL_NO` varchar(255) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `longitude` float DEFAULT NULL,
  `latitude` float DEFAULT NULL,
  `images` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `SERIAL_NO` (`SERIAL_NO`)
)

CREATE TABLE `minor` (
  `id` int NOT NULL AUTO_INCREMENT,
  `REF_WP` varchar(255) DEFAULT NULL,
  `avBegin` date DEFAULT NULL,
  `avEnd` date DEFAULT NULL,
  `langinfo` varchar(255) DEFAULT NULL,
  `SERIAL_NO` varchar(255) DEFAULT NULL,
  `RowNumber` int DEFAULT NULL,
  `MEMO_TIME` text,
  `POI` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `SERIAL_NO` (`SERIAL_NO`),
  CONSTRAINT `minor_ibfk_1` FOREIGN KEY (`SERIAL_NO`) REFERENCES `major` (`SERIAL_NO`)
)
```