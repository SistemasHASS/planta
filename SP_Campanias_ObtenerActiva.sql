-- Crear Stored Procedure para obtener la campaña activa
CREATE PROCEDURE SP_Campanias_ObtenerActiva
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP 1 
        Id, 
        Nombre, 
        FechaInicio, 
        FechaFin, 
        Activa, 
        FechaCreacion
    FROM Campanias
    WHERE Activa = 1
    ORDER BY FechaCreacion DESC;
END
