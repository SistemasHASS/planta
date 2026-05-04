-- Stored Procedure para eliminar composición de un palet
CREATE PROCEDURE [dbo].[SP_Test_Palets_Composicion_Eliminar]
    @PaletId INT,
    @ComposicionId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Eliminar la composición
    DELETE FROM PaletComposicion 
    WHERE Id = @ComposicionId AND PaletId = @PaletId;
    
    -- Actualizar el palet
    UPDATE Palets
    SET 
        CantidadCajas = (SELECT ISNULL(SUM(CantidadCajas), 0) FROM PaletComposicion WHERE PaletId = @PaletId),
        PesoTotal = (SELECT ISNULL(SUM(PesoTotal), 0) FROM PaletComposicion WHERE PaletId = @PaletId),
        PorcentajeAvance = CASE 
            WHEN f.LimiteCajasPorPalet IS NOT NULL AND f.LimiteCajasPorPalet > 0
            THEN CAST((SELECT ISNULL(SUM(CantidadCajas), 0) FROM PaletComposicion WHERE PaletId = @PaletId) * 100.0 / f.LimiteCajasPorPalet AS DECIMAL(5,2))
            ELSE 0
        END,
        FechaModificacion = GETDATE()
    FROM Palets p
    LEFT JOIN Formatos f ON p.FormatoId = f.Id
    WHERE p.Id = @PaletId;
    
    -- Devolver success
    SELECT 1 as Result;
END
